---
type: Reference
title: What pr-policy-action is
description: The composite Action that installs a pinned @rmartz/pr-policy CLI, evaluates one PR, and posts the blocking pr-policy verdict (a check-run and a matching commit status), one informational status per check, and the labels the CLI owns — its inputs and what it never does.
tags: [pr-policy, action, overview]
---

# What pr-policy-action is

A composite GitHub Action. It installs the `@rmartz/pr-policy` CLI version pinned
in this repo's lockfile, then evaluates one PR through its library API (what
`pr-policy evaluate` does). On a `status` event for pr-lifecycle's
`pr-lifecycle/sign-off` status it does this for every open PR whose head is
that commit, and it skips any other status
([consuming.md](consuming.md#re-running-on-pr-lifecycles-sign-off-status)). It:

1. reads the PR's title, labels, changed files, and both sides of every changed
   `.github/workflows/**` file through the API;
2. runs every registered policy check, minus the UAT gate when `skip-uat` is
   set (the list lives in
   [rmartz/pr-policy's docs](https://github.com/rmartz/pr-policy/blob/main/docs/checks/index.md));
3. posts the `pr-policy` verdict on the PR head, as a check-run and a commit
   status with the same state: `failure` on a finding the author can fix,
   pending while it waits on a human sign-off, otherwise `success` (see
   [the check-run contract](https://github.com/rmartz/pr-policy/blob/main/docs/check-run-contract.md)).
   The status keeps the gate working when GitHub supersedes the check-run's
   check suite ([consuming.md](consuming.md#the-pr-policy-verdict-a-check-run-and-a-commit-status));
4. writes the labels its checks own outright (today, `CI approval needed`);
5. posts one commit status per check, `pr-policy / <check>`: `failure` on a
   blocking finding, `pending` while that check waits on a human, otherwise
   `success`. The description is the finding that decided it. These statuses
   are informational; `pr-policy` stays the one required gate.

It never checks out or executes the PR's code, and never applies
`CI change approved`: that is the human sign-off the CI gate exists to require.
The one thing it may change on the PR is the title of a Dependabot
linter/formatter bump, and only with `retitle-dependabot-ci`
([consuming.md](consuming.md#dependabot-linter-bumps-retitle-dependabot-ci)).

## Inputs

| Input                      | Default                      | Meaning                                                                             |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `pr`                       | _(none)_                     | The PR number (`github.event.pull_request.number`). Ignored on `status`.            |
| `token`                    | `${{ github.token }}`        | Installs the CLI, reads the PR, posts the check-run and statuses, writes labels.    |
| `node-version`             | `'22'`                       | Node.js version the CLI runs under.                                                 |
| `statuses`                 | `'true'`                     | Post one commit status per check. `'false'` turns it off.                           |
| `status-context`           | `'pr-policy'`                | Status name prefix: `<prefix> / <check>`.                                           |
| `skip-uat`                 | `'false'`                    | `'true'` drops the UAT gate, for a repo with nothing to user-test.                  |
| `sign-off-status-creators` | `'rmartz-pr-lifecycle[bot]'` | GitHub App logins trusted to post `pr-lifecycle/sign-off`. `''` trusts only people. |
| `require-uat-label`        | `'false'`                    | `'true'` holds a PR that carries no UAT label. Needs the `workflow_run` trigger.    |
| `retitle-dependabot-ci`    | `'false'`                    | `'true'` retitles a Dependabot linter/formatter bump to `ci` before evaluating.     |

There is no `version` input. The CLI version is the one pinned in this Action's
lockfile, so an Action ref is a reproducible policy.
