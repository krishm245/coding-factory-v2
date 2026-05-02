const BASE_IMAGE = "node:20-bookworm-slim";

export type AgentName = "codex" | "claude";

export interface AgentRuntimeDefinition {
  readonly binaryName: string;
  readonly name: AgentName;
  readonly packageName: string;
  readonly requiredSecrets: readonly string[];
}

const AGENT_RUNTIMES: Record<AgentName, AgentRuntimeDefinition> = {
  claude: {
    binaryName: "claude",
    name: "claude",
    packageName: "@anthropic-ai/claude-code",
    requiredSecrets: ["ANTHROPIC_API_KEY"]
  },
  codex: {
    binaryName: "codex",
    name: "codex",
    packageName: "@openai/codex",
    requiredSecrets: ["OPENAI_API_KEY"]
  }
};

export class AgentRuntimeCatalog {
  get(agentName: AgentName): AgentRuntimeDefinition {
    return AGENT_RUNTIMES[agentName];
  }

  buildDockerfile(agentName: AgentName): string {
    const runtime = this.get(agentName);

    return `FROM ${BASE_IMAGE}

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV GIT_TERMINAL_PROMPT=0

RUN corepack enable

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

RUN pnpm add --global ${runtime.packageName}

WORKDIR /workspace

# The host repository is mounted into /workspace when orchestration runs.
CMD ["${runtime.binaryName}", "--help"]
`;
  }

  buildEnvTemplate(agentName: AgentName): string {
    const runtime = this.get(agentName);
    const lines = [
      "# Fill in these values before running `coding-factory issue <number>`.",
      ...runtime.requiredSecrets.map((secretName) => `${secretName}=`),
      "GITHUB_TOKEN="
    ];

    return `${lines.join("\n")}\n`;
  }
}
