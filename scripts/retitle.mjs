// Retitles a Dependabot PR that bumps a CI-sensitive linter or formatter to the
// `ci` type, which is the title pr-policy's sensitive-bump rule demands.
// Dependabot can't set that type itself (`commit-message.prefix` is per
// ecosystem, not per group), and pr-policy never renames a PR, so the Action
// does it, opt-in, before the checks run. See docs/consuming.md.
//
// It reuses the title check's own detection (`sensitiveBumps`) and grammar
// (`parseTitle`), so the retitle and the block can never disagree about which
// bumps count or what a type is.

import { DEPENDABOT_LOGIN, FUNCTIONAL_TYPES, parseTitle, sensitiveBumps } from '@rmartz/pr-policy';

/**
 * The `ci` title for this PR, or `undefined` to leave the title alone. Only a
 * Dependabot PR with a sensitive bump is retitled, and never one already typed
 * `ci` or a release type: demoting `fix`/`feat`/`perf`/`revert` would cancel a
 * release. Scope, `!`, and subject are kept.
 */
export function ciRetitle(facts) {
  if (facts.author?.login !== DEPENDABOT_LOGIN) return undefined;
  const title = parseTitle(facts.title);
  if (title === null || title.type === 'ci' || FUNCTIONAL_TYPES.includes(title.type)) {
    return undefined;
  }
  if (sensitiveBumps(facts.manifestChanges).length === 0) return undefined;
  return `ci${facts.title.slice(title.type.length)}`;
}

/** Set the PR's title through the REST API. Throws on a failed request. */
export async function setTitle({ repo, pr, token, apiUrl }, title) {
  const response = await fetch(`${apiUrl}/repos/${repo}/pulls/${pr}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
