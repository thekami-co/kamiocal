import { stdin, stdout } from "node:process";

export function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error("Prompt requires an interactive terminal."));
      return;
    }

    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (err?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      err ? reject(err) : resolve(value);
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish();
        if (ch === "\u0003")
          return finish(new Error("Password entry cancelled."));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };

    stdin.on("data", onData);
  });
}

export async function promptPassword(): Promise<string> {
  const password = await askHidden("Set password: ");
  if (!password.trim()) throw new Error("Password cannot be empty.");

  const confirmation = await askHidden("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  return password;
}
