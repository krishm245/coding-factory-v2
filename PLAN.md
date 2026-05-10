# coding-factory Plan

## Project Goal

Build `coding-factory issue <number>` into an end-to-end workflow that:

1. Validates the repo state and project config.
2. Starts one Docker worker container with the repo mounted and the required CLIs installed.
3. Fetches the GitHub issue title and body.
4. Generates a normalized requirements brief at the configured docs path as `issue-<number>.md`.
5. Creates the local branch `coding-factory/issue-<number>` early in the run.
6. Invokes the selected agent CLI once with one orchestrated implementation prompt.
7. Has the agent run the configured test command and keep fixing until tests pass or a global timeout is hit.
8. Creates one final commit using the GitHub issue title as the commit message.
9. Pushes the branch to GitHub only after success.
10. Always stops and removes the worker container.

## Cross-Cutting Rules

- Use `createProgram(dependencies = {})` as the CLI composition root.
- Expose every new external interaction as an injectable seam immediately.
- Use a high-level dependency bag for issue orchestration concerns such as git, Docker, GitHub, agent execution, filesystem writes, and progress logging.
- Use lower-level injected runtime helpers with defaults for process execution, timeout behavior, env loading, and platform-specific interactions.
- Use classes for new services.
- Keep tests fast and deterministic by stubbing dependencies and asserting calls, arguments, order, skipped steps, and output.
- Fail fast on dirty working trees.
- Persist the generated requirements markdown as part of the repo branch contents.

## Milestones

### [X] Milestone 1: Issue Command Foundation

Goal: Replace the placeholder `issue` command with a real orchestration entrypoint that follows the repo's DI pattern.

Implementation:

- Add a top-level issue orchestration class and dependency bag.
- Keep `src/cli.ts` as the production composition root.
- Move orchestration wiring behind injectable command dependencies.
- Keep validation and data-shaping logic separate from side effects where practical.

Acceptance criteria:

- `coding-factory issue <number>` enters a real orchestration flow instead of printing a placeholder message.
- CLI tests build the program with fake dependencies and run `parseAsync(...)`.
- The orchestration path is testable without Docker, git, GitHub, or filesystem side effects.

Depends on: none

### [X] Milestone 2: Repo Validation and Branch Lifecycle

Goal: Validate the repo before work starts and create the issue branch early.

Implementation:

- Add git services for checking repo cleanliness and creating branches.
- Abort immediately if the working tree is dirty.
- Create `coding-factory/issue-<number>` before generating the requirements file or implementation changes.
- Use the configured branch prefix when constructing the branch name.

Acceptance criteria:

- Dirty repos fail before Docker or GitHub work starts.
- Clean repos create the local issue branch early.
- Tests assert that downstream steps are skipped when repo validation fails.

Depends on: Milestone 1

### [X] Milestone 3: Docker Worker Lifecycle

Goal: Run the full workflow inside one long-lived Docker worker container.

Implementation:

- Add Docker service classes for starting, stopping, and removing the worker container.
- Mount the repo into the container.
- Use the configured Dockerfile path / image configuration to ensure the agent CLI and GitHub CLI are available.
- Guarantee cleanup on success, failure, and timeout.

Acceptance criteria:

- Exactly one worker container is started for an issue run.
- The container is always stopped and removed at the end.
- Tests assert cleanup is attempted on both success and failure paths.

Depends on: Milestone 2

### [ ] Milestone 4: GitHub Issue Fetch

Goal: Fetch the GitHub issue title and body for the requested issue number.

Implementation:

- Add GitHub integration for issue lookup.
- Authenticate from inside the container using the token available through `.coding-factory/.env`.
- Fetch issue title and body only in v1.
- Surface clear failures for missing credentials, missing issue data, or GitHub command errors.

Acceptance criteria:

- A valid issue number returns title and body.
- Comments are not fetched in v1.
- Tests cover success, missing token, and fetch failure behavior.

Depends on: Milestone 3

### [ ] Milestone 5: Requirements Brief Generation

Goal: Create a normalized markdown requirements brief from the GitHub issue.

Implementation:

- Generate a structured markdown document with sections such as summary, acceptance criteria, assumptions, and implementation notes.
- Write the file under the configured `requirementsDocPath`.
- Use the deterministic filename `issue-<number>.md`.
- Treat the generated brief as part of the issue branch contents.

Acceptance criteria:

- The requirements file is created at the expected path.
- The content is deterministic for the same issue input.
- Tests assert path, filename, and generated content shape.

Depends on: Milestone 4

### [ ] Milestone 6: Agent Invocation

Goal: Invoke the selected agent CLI once with one composed implementation prompt.

Implementation:

- Add an agent runner service.
- Build one orchestrated prompt that includes the requirements file path, the branch goal, and the configured test command.
- Instruct the agent to implement the issue and run/fix tests until green or timeout.
- Keep agent invocation injectable for tests.

Acceptance criteria:

- The orchestration invokes the selected agent exactly once.
- The prompt includes the requirements file path and test command.
- Tests assert exact invocation arguments.

Depends on: Milestone 5

### [ ] Milestone 7: Completion and Timeout Behavior

Goal: Define what counts as success or failure for the end-to-end issue run.

Implementation:

- Enforce a global timeout for the full issue workflow.
- Treat passing tests as the success condition.
- Treat timeout or unrecoverable agent/test failure as command failure.
- Ensure failure paths still run container cleanup and do not push a branch.

Acceptance criteria:

- Passing tests allow the flow to continue to commit/push.
- Timeout aborts the run cleanly.
- Tests assert push is skipped on failure and cleanup still occurs.

Depends on: Milestone 6

### [ ] Milestone 8: Commit and Push

Goal: Publish successful work to GitHub in a deterministic way.

Implementation:

- Create one final commit after the workflow reaches a green test state.
- Use the GitHub issue title as the commit message.
- Push `coding-factory/issue-<number>` from inside the container using token-based auth.
- Never push automatically on failure.

Acceptance criteria:

- Successful runs create one final commit and push the expected branch.
- Failed runs do not push.
- Tests assert commit message, branch name, and push sequencing.

Depends on: Milestone 7

### [ ] Milestone 9: User-Facing Progress Output

Goal: Make the workflow observable without relying on persistent run logs.

Implementation:

- Emit progress output for validation, branch creation, container startup, issue fetch, requirements generation, agent execution, commit, push, and cleanup.
- Keep output deterministic enough for CLI tests.
- Keep persistent failure artifacts limited to the generated requirements markdown in v1.

Acceptance criteria:

- Users can tell which stage is running and where failures occurred.
- Tests assert the key progress messages and their order.

Depends on: Milestone 8

## Test Strategy

- Test through the public CLI API by constructing the program with fake dependencies and calling `parseAsync(...)`.
- Avoid module-level mocking when runtime injection is sufficient.
- Assert exact dependency calls, arguments, sequencing, skipped downstream steps, and final output.
- Cover failure paths for:
  - dirty working tree
  - missing project config
  - missing credentials
  - Docker startup failure
  - GitHub fetch failure
  - requirements file write failure
  - timeout before green
  - push skipped on failure
  - cleanup always attempted
- Cover success paths for:
  - early branch creation
  - requirements file path and name
  - single agent invocation
  - final commit creation
  - successful push to `coding-factory/issue-<number>`

## Assumptions and Deferred Items

- `issue` is end-to-end by default; checkpointed interactive mode is not part of v1.
- The requirements source is the GitHub issue title and body only; comments are deferred.
- The worker model is one long-lived container for the full run.
- The implementation loop has no retry-count cap, but the full run is bounded by a global timeout.
- The container is responsible for reading `.coding-factory/.env`.
- GitHub push/auth happens from inside the container.
- Persistent run logs are deferred; only the requirements markdown is a required durable artifact in v1.
