# pr-policy-action

A composite GitHub Action that runs the
[`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) checks on a pull request
and posts the single blocking **`pr-policy`** check-run. Each check is a read-only
classifier of the PR's own content: today, CI-change classification (a workflow
loosening needs a human's `CI change approved`); title-type rules come next.

```yaml
# .github/workflows/pr-policy.yml
name: pr-policy
on:
  pull_request_target:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled]
permissions:
  checks: write
  pull-requests: write
  contents: read
  packages: read
  statuses: write # one commit status per policy check
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

Then require the `pr-policy` status on your default branch. Each policy check
also gets its own informational status (`pr-policy / title`,
`pr-policy / ci-change`, …) that shows failed, pending, or passed, so a reader
sees which check is holding the PR without opening the check-run. The full setup, and
why this runs on `pull_request_target`, is in the
[consumer guide](docs/consuming.md).

The policy logic lives in `@rmartz/pr-policy`. This repo pins that CLI, wraps it
in [`action.yml`](action.yml), and re-releases itself whenever Dependabot bumps
the pin. See the [documentation](docs/index.md).

---

🤖 Created by Claude Opus 5.5
