import type { AgentName } from "./config.js";

const BASE_IMAGE = "node:20-bookworm-slim";

export function buildDockerfile(agent: AgentName): string {
  const agentPackage =
    agent === "codex" ? "@openai/codex" : "@anthropic-ai/claude-code";
  const agentBinary = agent === "codex" ? "codex" : "claude";

  return `FROM ${BASE_IMAGE}

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

ENV GIT_TERMINAL_PROMPT=0

# The host repository is mounted into /workspace when orchestration runs.
CMD ["${agentBinary}", "--help"]
`;
}
