# Context

## Terms

- **Project initialization**: the workflow behind `coding-factory init` that gathers repository settings and writes the managed artifacts in `.coding-factory/`.
- **Managed artifacts**: the files owned by project initialization: `config.json`, `.env`, and `Dockerfile` inside `.coding-factory/`.
- **Agent runtime**: the per-agent policy that defines required secrets, bootstrap details, and the executable invoked in the worker image.
- **Issue orchestration**: the workflow behind `coding-factory issue <number>` that validates input, loads project config, and coordinates repository work against a GitHub issue.
