// Evaluates one PR with @rmartz/pr-policy and posts one commit status per
// policy check, so the PR's status list shows which check failed, which one is
// waiting on a human, and which passed, without opening the check-run.
//
// It does what `ai-pr-policy evaluate --pr <n> --repo <owner/repo>` does (gather
// facts, apply label edits, post the one `pr-policy` check-run) through the
// package's library API, because it needs each finding's `check` to group them.
// The per-check statuses are informational: the `pr-policy` check-run stays the
// one required gate, and a status is never named exactly `pr-policy`.
//
// Inputs arrive as INPUT_* env vars set by action.yml; GH_TOKEN is read by the
// library's `gh` calls. See docs/design/integration-contract.md.

import {
  CHECKS,
  applyLabelEdits,
  evaluatePolicy,
  gatherFacts,
  postCheckRun,
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

  const target = { repo, pr };
  const { facts, headSha } = await gatherFacts(target);
  const evaluation = await evaluatePolicy(facts);
  await applyLabelEdits(target, evaluation);
  await postCheckRun(target, headSha, evaluation);
  console.log(`${repo}#${pr}: ${evaluation.outcome} — ${evaluation.title}`);

  const results = CHECKS.map(({ name }) => summarize(name, evaluation.findings));
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
      // `pr-policy` check-run already carries the verdict.
      console.log(
        `::warning title=pr-policy::Could not post per-check statuses (${failure}). ` +
          'Grant the job `statuses: write`, or set `statuses: false` to silence this.',
      );
      return;
    }
  }
}
