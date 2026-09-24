# Agent guide — pr-policy-action

This repo is the **composite GitHub Action** that runs the
[`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) checks in a consuming
repo. It pins the CLI in `package.json`, wraps it in [`action.yml`](action.yml),
and re-releases itself via semantic-release whenever Dependabot bumps that pin.
It dogfoods itself: [`pr-policy.yml`](.github/workflows/pr-policy.yml) runs the
local Action (`uses: ./`) on this repo's own PRs. See [README.md](README.md) and
the [documentation](docs/index.md).

**Policy logic doesn't belong here.** A new check, a rule change, or a label
change goes in `rmartz/pr-policy` and arrives as a CLI bump.

## Start and finish every task with the docs

**At task start:** read [docs/index.md](docs/index.md) and every page your change
touches, especially
[docs/design/integration-contract.md](docs/design/integration-contract.md)
before changing `action.yml`.

**At task finish, in the same PR:**

- **Extend.** A new input, step, or consumer requirement gets documented.
- **Update.** Fix anything your change made wrong. An outdated doc is worse than
  no doc.
- **Trim.** Delete what's no longer true, and link to the one home instead of
  restating it (the check list lives in rmartz/pr-policy, not here).
- **Correct drift you pass.** Fix a stale page you notice, or note it in the PR.

Pages follow OKF and the nested-index rule, enforced by the `okf`, `okf-index`,
and `docs-links` checks. See [docs/okf-format.md](docs/okf-format.md).

## Contracts

- The CLI posts the check-run named **`pr-policy`**. Consumers require it by
  literal name, so no job or step here may post a status with that name. The
  dogfood job is named `pr-policy (evaluate)` for that reason. The per-check
  statuses the runner posts are `<status-context> / <check>`, never the bare
  name.
- `action.yml` input metadata must not contain `${{ }}` expressions in
  descriptions; the manifest is validated without the `github` context.
- The Action never checks out or runs PR code. That's what makes the
  `pull_request_target` write token safe. Don't add a step that does.

## Repository conformance

This repo follows the shared
[repository checklist](https://github.com/rmartz/ai/blob/main/docs/guidance/repository-checklist.md)
and self-manages its config: fix gaps here, in a PR.

- **Hygiene** via `rmartz/repo-hygiene-action`, every check at `severity: error`.
- **CI:** Format and a semantic-release dry-run ([ci.yml](.github/workflows/ci.yml)),
  PR-title lint, and the post-merge
  [commit-convention](.github/workflows/commit-convention.yml) tripwire.
- **Merge flow:** merge-safety, bot-automerge (safe only while merge-safety and
  CI are required checks), and the `pr-policy` dogfood.
- **Dependabot** needs the `DEPENDABOT_PACKAGES_TOKEN` Dependabot secret to see
  new CLI versions (see [.github/dependabot.yml](.github/dependabot.yml)).

## Common commands

```bash
npm ci                 # install deps (needs GitHub Packages auth for @rmartz/*)
npm run format:check   # prettier --check .
npm run format         # prettier --write .
```

There is no build or test suite; the logic and its tests live in
`@rmartz/pr-policy`. The real test is the dogfood run on this repo's PRs.

## Releases

semantic-release ([`.releaserc.json`](.releaserc.json)) tags the Action and cuts
a GitHub Release on every releasable merge to `main`. It publishes nothing and
commits nothing back. The Action has its own SemVer line; a CLI bump's type is
mirrored into the Action release by
[`dependabot-release-type`](.github/workflows/dependabot-release-type.yml). See
[docs/design/distribution-pipeline.md](docs/design/distribution-pipeline.md).

## Worktrees & PRs

- **Work in a dedicated worktree** under `.git-worktrees/` (`ai-new-worktree`),
  never on `main` in the root checkout. Run `npm ci` in a fresh worktree.
- **PR titles must be Conventional Commits.** The repo squash-merges with the PR
  title. `!` is allowed only on `feat`, `fix`, `perf`, and `revert`.

## Agent directive files

- **`AGENTS.md` is the single source of truth** for agent instructions. Write
  directives here, never in `CLAUDE.md`.
- **Every `AGENTS.md` has a companion `CLAUDE.md`** containing only `@AGENTS.md`,
  enforced by the `md-pairing` check.
