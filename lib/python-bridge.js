import { spawn } from "node:child_process";

export async function callPython(command, data = {}) {
  const input = JSON.stringify({ command, ...data });

  return await new Promise((resolve, reject) => {
    const child = spawn("python3", ["api_bridge.py"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(error.message || "Python bridge failed"));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const parsed = tryParseJson(stdout);
        reject(new Error(parsed?.error || stderr.trim() || "Python bridge failed"));
        return;
      }
      const parsed = tryParseJson(stdout);
      if (parsed?.error) {
        reject(new Error(parsed.error));
        return;
      }
      resolve(parsed || {});
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

function tryParseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}
