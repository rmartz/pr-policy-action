# pr-policy-action

A composite GitHub Action that runs the
[`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) checks on a pull request
and posts the single blocking **`pr-policy`** verdict, as a check-run and a
matching commit status. Each check is a read-only classifier of the PR's own
content; the list lives in
[rmartz/pr-policy's docs](https://github.com/rmartz/pr-policy/blob/main/docs/checks/index.md).

```yaml
# .github/workflows/pr-policy.yml
name: pr-policy
on:
  pull_request_target:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled]
  status: # re-run when pr-lifecycle posts its sign-off status
permissions:
  checks: write
  pull-requests: write
  contents: read
  statuses: write # the pr-policy commit status, plus one per policy check
concurrency:
  group: pr-policy-${{ github.event.pull_request.number || github.event.sha }}
  cancel-in-progress: true
jobs:
  pr-policy:
    name: pr-policy (evaluate)
    # Only pr-lifecycle's sign-off status re-runs the gate; skip every other one.
    if: github.event_name != 'status' || github.event.context == 'pr-lifecycle/sign-off'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: rmartz/pr-policy-action@<sha> # vX.Y.Z
        with:
          pr: ${{ github.event.pull_request.number }}
```

Then require the `pr-policy` status on your default branch. Each policy check
also gets its own informational status (`pr-policy / title`,
`pr-policy / ci-change`, …) that shows failed, pending, or passed, so a reader
sees which check is holding the PR without opening the check-run.

The `status` trigger re-evaluates the PR when
[pr-lifecycle](https://github.com/rmartz/pr-lifecycle) posts its
`pr-lifecycle/sign-off` status, which says whether the head needs a UAT or CI
sign-off. A status event names a commit, not a PR, so the Action evaluates every
open PR whose head is that commit, and the `pr` input is empty and ignored. The
job's `if:` keeps a runner from starting for any other status; the Action skips
them too. It needs no permission beyond the ones above. A `status` workflow always
runs from the default branch, so a PR can't change what it does.

pr-policy trusts that status only from a person who could merge, or from a GitHub
App named in `sign-off-status-creators`. It defaults to the fleet's pr-lifecycle
App, `rmartz-pr-lifecycle[bot]`, so a caller needs no setting. Override it only
when pr-lifecycle posts as a different App (list both during a switch), or set it
to `''` to trust only people:

```yaml
with:
  pr: ${{ github.event.pull_request.number }}
  sign-off-status-creators: rmartz-pr-lifecycle[bot], my-new-lifecycle-app[bot]
```

A status from anyone else is ignored, not held on: pr-policy classifies the PR
itself and names the creator in a finding, so a mismatch never locks the repo.
Logins match exactly, and `github-actions[bot]` is refused because any workflow
can post as it. See
[trusting pr-lifecycle's App](docs/consuming.md#trusting-pr-lifecycles-app-sign-off-status-creators).

The full setup, and why this runs on `pull_request_target`, is in the
[consumer guide](docs/consuming.md).

The policy logic lives in `@rmartz/pr-policy`. This repo pins that CLI, wraps it
in [`action.yml`](action.yml), and re-releases itself whenever Dependabot bumps
the pin. See the [documentation](docs/index.md).

---

🤖 Created by Claude Opus 5.5
