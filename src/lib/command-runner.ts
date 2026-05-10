import { spawn } from "node:child_process";

export interface CommandRunOptions {
  cwd: string;
}

export interface CommandRunResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export class NodeCommandRunner {
  async run(
    command: string,
    args: readonly string[],
    options: CommandRunOptions,
  ): Promise<CommandRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.once("error", (error) => {
        reject(error);
      });

      child.once("close", (code, signal) => {
        const signalMessage =
          signal === null ? "" : `Process exited due to signal ${signal}.`;

        resolve({
          exitCode: code ?? 1,
          stderr:
            stderr && signalMessage
              ? `${stderr}\n${signalMessage}`
              : `${stderr}${signalMessage}`,
          stdout,
        });
      });
    });
  }
}
