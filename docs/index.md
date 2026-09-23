---
okf_version: 0.2
---

# Documentation

Documentation for `pr-policy-action`, the composite GitHub Action that runs the
[`@rmartz/pr-policy`](https://github.com/rmartz/pr-policy) checks in a consuming
repo. Written in [Open Knowledge Format](okf-format.md).

- [What pr-policy-action is](overview.md): what the Action does, its inputs,
  and what it posts.
- [Using it in a consuming repo](consuming.md): the caller workflow, its
  permissions, making `pr-policy` required, and keeping the pin current.
- [The OKF documentation format](okf-format.md): how these pages are structured
  and validated.
- [Design & distribution](design/index.md): how the Action wraps the CLI and how
  new versions reach consumers.
