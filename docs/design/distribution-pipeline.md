---
type: Design
title: The distribution pipeline and versioning
description: How a new @rmartz/pr-policy release reaches consuming repos automatically — Dependabot bump, release-type mapping, auto-merge, Action release, consumer pin bump — and why the Action carries its own SemVer line.
tags: [design, releases, dependabot, versioning]
---

# The distribution pipeline and versioning

## The chain

1. `rmartz/pr-policy` releases a new CLI version to npmjs.
2. Dependabot (npm ecosystem, checked daily, no registry auth needed) opens a
   `fix(deps): bump @rmartz/pr-policy …` PR here on its next daily run. The CLI
   is exempt from Dependabot's default 3-day release cooldown, since it's
   first-party; other dependencies keep that cooldown.
3. [`dependabot-release-type`](../../.github/workflows/dependabot-release-type.yml)
   rewrites the title to mirror the CLI's bump: patch stays `fix(deps):`, minor
   becomes `feat(deps):`, major becomes `feat(deps)!:` plus the `breaking change`
   label.
4. bot-automerge auto-merges patch and minor bumps once the required checks pass.
   A major waits for a human.
5. [`release.yml`](../../.github/workflows/release.yml) runs semantic-release
   through the fleet's shared
   [semantic-release-ci](https://github.com/rmartz/semantic-release-ci) workflow,
   which tags the Action and creates the GitHub Release. It publishes nothing and
   commits nothing back. The required `release-check / release-check` check
   ([`release-check.yml`](../../.github/workflows/release-check.yml)) proves the
   release config renders with the shared toolchain on every PR, so a broken
   release config fails the PR rather than stalling this chain after an
   auto-merge.
6. Each consumer's Dependabot `github-actions` entry bumps its SHA pin.

## Versioning

The Action has its own SemVer line, independent of the CLI's number, the same
policy as
[bot-automerge-action](https://github.com/rmartz/bot-automerge-action/blob/main/docs/design/versioning.md).
Its version describes the wrapper's contract: its inputs, the invocation, the
steps. A CLI bump's _type_ is mirrored as a default (step 3). A reviewer can
downgrade a CLI major by removing the `!` and the label, but only after
confirming nothing visible to Action consumers changed. A new blocking check
reaching consumers is visible, so the CLI should ship it as a `feat`.
