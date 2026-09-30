// Evaluates one PR with @rmartz/pr-policy and posts one commit status per
// policy check, so the PR's status list shows which check failed, which one is
// waiting on a human, and which passed, without opening the check-run.
//
// It does what `pr-policy evaluate --pr <n> --repo <owner/repo>` does (gather
// facts, apply label edits, post the `pr-policy` verdict) through the package's
// library API, because it needs each finding's `check` to group them.
//
// The verdict is the `pr-policy` check-run plus a `pr-policy` commit status with
// the same state. The status is the gate fix, not an informational extra: a
// GITHUB_TOKEN check-run lands in an existing check suite, and once a newer run
// supersedes that suite the merge gate ignores it while it still reads green
// (rmartz/pr-policy#24). So it is posted whatever the `statuses` input says.
// The per-check statuses (`<context> / <check>`) are the informational ones.
//
// Inputs arrive as INPUT_* env vars set by action.yml; GH_TOKEN is read by the
// library's `gh` calls. See docs/design/integration-contract.md.

import {
  applyLabelEdits,
  evaluatePolicy,
  gatherFacts,
  postVerdict,
  selectChecks,
} from '@rmartz/pr-policy';

const env = process.env;

// The Statuses API rejects a description over 140 characters.
const MAX_DESCRIPTION = 140;

const STATES = { block: 'failure', hold: 'pending' };

try {
  const repo = env.GITHUB_REPOSITORY;
  const pr = Number(env.INPUT_PR);
  if (!repo || !Number.isInteger(pr) || pr <= 0) {
    console.error(`pr-policy: need a repository and a PR number (got "${env.INPUT_PR}").`);
    process.exit(2);
  }

  // The caller workflow sets these, never the PR: a pull_request_target caller
  // runs from the base branch, so a PR can't switch off a gate it would wait on.
  // Only the literal 'true' opts out; anything else keeps the strictest policy.
  const checks = selectChecks({ skipUat: env.INPUT_SKIP_UAT === 'true' });

  const target = { repo, pr };
  const { facts, headSha } = await gatherFacts(target);
  const evaluation = await evaluatePolicy(facts, checks);
  await applyLabelEdits(target, evaluation);
  await postVerdict(target, headSha, evaluation);
  console.log(`${repo}#${pr}: ${evaluation.outcome} — ${evaluation.title}`);

  // A skipped check is left out entirely, so it posts no status either.
  const results = checks.map(({ name }) => summarize(name, evaluation.findings));
  for (const result of results) {
    console.log(`  ${result.check}: ${result.state} — ${result.description}`);
  }

  if (env.INPUT_STATUSES === 'true') {
    await postStatuses(repo, headSha, results);
  }
} catch (error) {
  // Same contract as the CLI: non-zero only when the evaluation could not run.
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

// One check's status: red on any `block`, pending on any `hold`, else green.
// The description leads with the finding that decided the state.
function summarize(check, findings) {
  const own = findings.filter((finding) => finding.check === check);
  const deciding =
    own.find((finding) => finding.effect === 'block') ??
    own.find((finding) => finding.effect === 'hold');
  const state = deciding ? STATES[deciding.effect] : 'success';
  const lead = deciding ?? own.find((finding) => finding.headline);
  const gating = own.filter((finding) => finding.effect !== 'info').length;
  let description = lead?.message ?? 'Passed';
  if (gating > 1) description += ` (+${gating - 1} more)`;
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 1)}…`;
  }
  return { check, state, description };
}

async function postStatuses(repo, sha, results) {
  if (!env.INPUT_TOKEN) {
    console.log('::notice title=pr-policy::Not posting per-check statuses: no token.');
    return;
  }

  const serverUrl = env.GITHUB_SERVER_URL ?? 'https://github.com';
  const targetUrl = `${serverUrl}/${repo}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT ?? 1}`;
  const prefix = env.INPUT_STATUS_CONTEXT || 'pr-policy';

  for (const { check, state, description } of results) {
    let failure;
    try {
      const response = await fetch(
        `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repo}/statuses/${sha}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.INPUT_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            state,
            context: `${prefix} / ${check}`,
            description,
            target_url: targetUrl,
          }),
        },
      );
      if (!response.ok) failure = `HTTP ${response.status}`;
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
    if (failure) {
      // Most often a job without `statuses: write`. Warn once and stop; the
      // `pr-policy` verdict is already posted (postVerdict warns on its own
      // status if the permission is missing).
      console.log(
        `::warning title=pr-policy::Could not post per-check statuses (${failure}). ` +
          'Grant the job `statuses: write`, or set `statuses: false` to silence this.',
      );
      return;
    }
  }
}
