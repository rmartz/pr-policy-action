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
  packages: read # install the CLI from GitHub Packages

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

No checkout step is needed: the CLI reads everything through the API.

Name the job something other than `pr-policy`. The CLI posts its own check-run
named exactly `pr-policy`; a job with the same name would add a second,
always-green status under the name your ruleset requires.

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

## 3. Seed the labels

`CI approval needed` and `CI change approved` must exist. `ai-ensure-labels` (or
`~/.claude/scripts/ensure-labels.py`) seeds them with the standard roster.

## 4. Keep the pin current

Pin the Action by commit SHA with a `# vX.Y.Z` comment, and make sure
`.github/dependabot.yml` has a `github-actions` entry. Dependabot bumps the pin,
and a new CLI version reaches you as an ordinary PR.
