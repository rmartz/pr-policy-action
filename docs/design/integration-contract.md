---
type: Design
title: The integration contract
description: What pr-policy-action relies on from the @rmartz/pr-policy CLI — the pinned install, the ai-pr-policy evaluate invocation, the environment it passes, and the permissions it assumes.
tags: [design, integration, cli]
---

# The integration contract

The Action owns no policy logic. It relies on exactly this from the CLI:

- **Package:** `@rmartz/pr-policy`, pinned exactly in `package.json` and locked in
  `package-lock.json`. `npm ci` installs it into `$GITHUB_ACTION_PATH`, never into
  the consumer's workspace.
- **Binary:** `ai-pr-policy`, invoked by absolute path from that install.
- **Invocation:** `ai-pr-policy evaluate --pr <n> --repo <owner/repo>`. It gathers
  the PR's facts, applies label edits, and posts the `pr-policy` check-run.
- **Environment:** `GH_TOKEN` for every `gh` call the CLI makes.
- **Exit status:** non-zero only when the evaluation itself could not run (for
  example, a workflow file it could not read). A policy failure is reported through
  the check-run, not the exit code, so a red policy result never also shows as a
  broken job. When the job does fail, no check-run is posted, so the required
  `pr-policy` status stays missing and the PR stays blocked: it fails closed.

If the CLI changes any of these, it is a breaking change for this Action, even
though it arrives as a dependency bump. See
[distribution-pipeline.md](distribution-pipeline.md).
