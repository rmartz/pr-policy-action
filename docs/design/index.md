# Design & distribution

How the Action is put together, and how a new version of the policy reaches
consumers with no per-repo work.

- [The integration contract](integration-contract.md): how the Action consumes
  `@rmartz/pr-policy`, the library API it calls, and the per-check statuses.
- [The distribution pipeline and versioning](distribution-pipeline.md): the CLI
  release → Dependabot bump → Action release → consumer bump chain, and how the
  Action's version relates to the CLI's.
