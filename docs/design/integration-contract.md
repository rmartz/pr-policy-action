---
type: Design
title: The integration contract
description: What pr-policy-action relies on from the @rmartz/pr-policy package — the pinned install, the library API its runner calls, the environment it passes, and the per-check statuses it derives.
tags: [design, integration, cli]
---

# The integration contract

The Action owns no policy logic. It relies on exactly this from the CLI:

- **Package:** `@rmartz/pr-policy`, pinned exactly in `package.json` and locked in
  `package-lock.json`. `npm ci` installs it into `$GITHUB_ACTION_PATH`, never into
  the consumer's workspace.
- **Library API, not the CLI.** The runner,
  [`scripts/evaluate.mjs`](../../scripts/evaluate.mjs), runs from the action's
  directory, so its `@rmartz/pr-policy` import resolves to that install. It does
  what `ai-pr-policy evaluate --pr <n> --repo <owner/repo>` does, in the same
  order: `gatherFacts`, `evaluatePolicy`, `applyLabelEdits`, `postCheckRun`. It
  calls the library because it needs each finding's `check` to post one status
  per check, and the CLI has no machine-readable output to recover that from.
- **What this relies on.** Those four functions, `CHECKS` (each check's `name`),
  and the `Finding` shape (`check`, `message`, `effect` of `block` / `hold` /
  `info`, `headline`). A CLI release that changes any of them breaks the runner.
- **Per-check statuses.** For each name in `CHECKS`, the runner posts the commit
  status `<status-context> / <check>` on the PR head: `failure` on a `block`
  finding, `pending` on a `hold`, else `success`, the same precedence the
  check-run uses. They are never named exactly `pr-policy`, so they can't shadow
  the required check-run. A failed post (usually a missing `statuses: write`)
  warns and doesn't fail the job.
- **Environment:** `GH_TOKEN` for every `gh` call the library makes.
- **Exit status:** non-zero only when the evaluation itself could not run (for
  example, a workflow file it could not read). A policy failure is reported through
  the check-run, not the exit code, so a red policy result never also shows as a
  broken job. When the job does fail, no check-run is posted, so the required
  `pr-policy` status stays missing and the PR stays blocked: it fails closed.

If the CLI changes any of these, it is a breaking change for this Action, even
though it arrives as a dependency bump. See
[distribution-pipeline.md](distribution-pipeline.md).
