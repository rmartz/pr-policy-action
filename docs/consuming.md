---
type: Guidance
title: Using pr-policy-action in a consuming repo
description: The caller workflow a consuming repo adds, the event types and permissions it needs, why it runs on pull_request_target, making pr-policy a required check, and keeping the pin current with Dependabot.
tags: [pr-policy, action, consuming, setup]
---

# Using pr-policy-action in a consuming repo

## 1. Add the caller workflow

```yaml
# .github/workflows/pr-policy.yml
name: pr-policy

on:
  pull_request_target:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled]

permissions:
  checks: write # post the pr-policy check-run
  pull-requests: write # write the labels pr-policy owns (CI approval needed)
  contents: read # read changed files at the merge base and head
  statuses: write # post the pr-policy commit status (the gate fix) and one per policy check

concurrency:
  group: pr-policy-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  pr-policy:
    name: pr-policy (evaluate)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: rmartz/pr-policy-action@<sha> # vX.Y.Z
        with:
          pr: ${{ github.event.pull_request.number }}
```

No checkout step is needed: the CLI reads everything through the API. No
`packages: read` is needed either: the `@rmartz/pr-policy` CLI installs from npmjs
with no auth. (Action versions from before the move installed from GitHub Packages
and needed it.)

Name the job something other than `pr-policy`. The CLI posts its own check-run
and commit status named exactly `pr-policy`; a job with the same name would add
another, always-green entry under the name your ruleset requires.

### The `pr-policy` verdict: a check-run and a commit status

The verdict is posted twice with the same state: as the `pr-policy` check-run
and as a `pr-policy` commit status. A check-run posted with `GITHUB_TOKEN` is
filed into an existing check suite on the head commit. When a newer run of that
suite's workflow lands on the same commit, GitHub treats the suite as superseded
and the merge gate ignores the check-run, while the PR still shows it green
(rmartz/pr-policy#24). A commit status belongs to no suite, so it can't be
superseded.

**Grant `statuses: write`.** Without it the Action warns and posts only the
check-run, and the PR stays exposed to that "all green and blocked" state. The
`statuses` input doesn't turn this status off.

### Per-check statuses

Besides the `pr-policy` verdict, the Action posts one commit status per policy
check, named `<status-context> / <check>` (`pr-policy / title`,
`pr-policy / ci-change`, …). Each is `failure` when that check found something
the author can fix, `pending` while it waits on a human sign-off, and `success`
otherwise, with the deciding finding as its description. So a reader sees which
check is red or waiting straight from the PR's status list.

- **Don't require them.** They're informational. `pr-policy` is the one required
  gate, and the set of checks grows with each CLI release; a required per-check
  status would need a ruleset edit every time.
- **Set `statuses: false`** to stop posting them. That leaves the `pr-policy`
  status alone.

### Repos without UAT: `skip-uat`

The UAT gate holds a PR until it's user-tested or marked as not needing it. A
repo with nothing to user-test, such as one that ships only a library or an
Action, can turn the gate off in its caller:

```yaml
- uses: rmartz/pr-policy-action@<sha> # vX.Y.Z
  with:
    pr: ${{ github.event.pull_request.number }}
    skip-uat: true
```

The title and CI-change checks are unchanged. The UAT check doesn't run at all,
so no `pr-policy / uat` status is posted, and `pr-policy` can pass without a UAT
label. The default, `false`, keeps the gate.

- **It lives in the caller workflow on purpose.** A `pull_request_target` caller
  runs from the default branch, so a PR can't switch off a gate it would
  otherwise wait on. A setting in a file the PR could edit would let it do
  exactly that.
- **Keep the name and value literal.** Agents decide whether a repo uses UAT by
  reading its caller workflow on the default branch for a
  `rmartz/pr-policy-action` step with `skip-uat: true`. Pass it as a plain
  `true`, not through an expression or a variable, so both the gate and the
  agents read the same setting.

### Why these event types

- `synchronize` keeps the verdict on the current head.
- `edited` re-evaluates when the title changes.
- `labeled` / `unlabeled` let a human's `CI change approved` clear the CI finding.

### Why `pull_request_target`

Under `pull_request`, fork PRs and every Dependabot PR get a read-only token, so
the check-run and label could not be written on exactly the PRs that most often
touch workflow files. `pull_request_target` runs with a base-context write token.
That is safe here only because nothing checks out or runs the PR's code.

## 2. Make `pr-policy` required

Add a required status check named exactly **`pr-policy`** to the default-branch
ruleset. That name is a frozen contract
([rmartz/pr-policy check-run contract](https://github.com/rmartz/pr-policy/blob/main/docs/check-run-contract.md)).
The check-run and the commit status both satisfy it, and both come from the
GitHub Actions app, so a rule that pins the source to GitHub Actions still
matches.

## 3. Seed the labels

`CI approval needed` and `CI change approved` must exist. `ai-ensure-labels` (or
`~/.claude/scripts/ensure-labels.py`) seeds them with the standard roster.

## 4. Keep the pin current

Pin the Action by commit SHA with a `# vX.Y.Z` comment, and make sure
`.github/dependabot.yml` has a `github-actions` entry. Dependabot bumps the pin,
and a new CLI version reaches you as an ordinary PR.
