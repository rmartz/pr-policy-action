---
type: Reference
title: What pr-policy-action is
description: The composite Action that installs a pinned @rmartz/pr-policy CLI, evaluates one PR, and posts the single blocking pr-policy check-run plus the labels the CLI owns — its inputs and what it never does.
tags: [pr-policy, action, overview]
---

# What pr-policy-action is

A composite GitHub Action. It installs the `@rmartz/pr-policy` CLI version pinned
in this repo's lockfile, then runs `ai-pr-policy evaluate` against one PR. The CLI:

1. reads the PR's title, labels, changed files, and both sides of every changed
   `.github/workflows/**` file through the API;
2. runs every registered policy check (the list lives in
   [rmartz/pr-policy's docs](https://github.com/rmartz/pr-policy/blob/main/docs/checks/index.md));
3. posts **one** `pr-policy` check-run on the PR head: `failure` on a finding the
   author can fix, pending while it waits on a human sign-off, otherwise
   `success` (see
   [the check-run contract](https://github.com/rmartz/pr-policy/blob/main/docs/check-run-contract.md));
4. writes the labels its checks own outright (today, `CI approval needed`).

It never checks out or executes the PR's code, and never applies
`CI change approved`: that is the human sign-off the CI gate exists to require.

## Inputs

| Input          | Default               | Meaning                                                             |
| -------------- | --------------------- | ------------------------------------------------------------------- |
| `pr`           | _(required)_          | The PR number to evaluate (`github.event.pull_request.number`).     |
| `token`        | `${{ github.token }}` | Installs the CLI, reads the PR, posts the check-run, writes labels. |
| `node-version` | `'22'`                | Node.js version the CLI runs under.                                 |

There is no `version` input. The CLI version is the one pinned in this Action's
lockfile, so an Action ref is a reproducible policy.
