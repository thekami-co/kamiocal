import { spawnSync } from "child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "fs";
import { arch, homedir, platform } from "os";
import { join } from "path";
import { createInterface } from "readline";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const binDir = join(homedir(), ".kamiocal", "bin");
const localBinary = join(binDir, platform() === "win32" ? "cloudflared.exe" : "cloudflared");
const isTermux = Boolean(process.env.PREFIX?.includes("com.termux"));
const releaseUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download";
const manualUrl = "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/";

const works = (command: string) => {
    const result = spawnSync(command, ["--version"], { stdio: "ignore" });
    return !result.error && result.status === 0;
};

export const findCloudflared = (): string | null => {
    if (works("cloudflared")) return "cloudflared";
    if (existsSync(localBinary) && works(localBinary)) return localBinary;
    return null;
};

const assetFor = (): { file: string; archive: boolean } | null => {
    const cpu = ({ x64: "amd64", arm64: "arm64", arm: "arm", ia32: "386" } as Record<string, string>)[arch()];

    if (!cpu) return null;

    switch (platform()) {
        case "win32":
            return cpu === "amd64" || cpu === "386" ? { file: `cloudflared-windows-${cpu}.exe`, archive: false } : null;
        case "darwin":
            return cpu === "amd64" || cpu === "arm64" ? { file: `cloudflared-darwin-${cpu}.tgz`, archive: true } : null;
        case "linux":
            return { file: `cloudflared-linux-${cpu}`, archive: false };
        default:
            return null;
    }
};

const ask = (question: string) =>
    new Promise<string>((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });

        // If the input closes without an answer, treat it as "no".
        rl.on("close", () => resolve("n"));
        rl.question(question, (answer) => {
            resolve(answer);
            rl.close();
        });
    });

const confirm = async (question: string) => {
    if (!process.stdin.isTTY) return false;

    const answer = (await ask(`${question} [Y/n] `)).trim().toLowerCase();

    return answer === "" || answer === "y" || answer === "yes";
};

const install = async (): Promise<string | null> => {
    if (isTermux) {
        const result = spawnSync("pkg", ["install", "-y", "cloudflared"], { stdio: "inherit" });
        return result.status === 0 ? findCloudflared() : null;
    }

    const asset = assetFor();

    if (!asset) return null;

    mkdirSync(binDir, { recursive: true });

    const temp = join(binDir, `${asset.file}.download`);

    try {
        const response = await fetch(`${releaseUrl}/${asset.file}`, { redirect: "follow" });

        if (!response.ok || !response.body) return null;

        await pipeline(
            Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
            createWriteStream(temp),
        );

        if (asset.archive) {
            if (spawnSync("tar", ["-xzf", temp, "-C", binDir], { stdio: "ignore" }).status !== 0) return null;
        } else {
            renameSync(temp, localBinary);
        }

        if (platform() !== "win32") chmodSync(localBinary, 0o755);

        return works(localBinary) ? localBinary : null;
    } catch {
        return null;
    } finally {
        rmSync(temp, { force: true });
    }
};

export const ensureCloudflared = async ({ yes }: { yes: boolean }): Promise<string | null> => {
    const found = findCloudflared();

    if (found) return found;

    const action = isTermux
        ? "install it with pkg"
        : `download the official build from Cloudflare's GitHub releases into ${binDir}`;

    console.log("\n cloudflared was not found. Kamiocal needs it for public tunnels.");

    if (!yes && !(await confirm(` Do you want Kamiocal to ${action}?`))) {
        console.log(` Install it manually: ${manualUrl}`);
        return null;
    }

    console.log(" Installing cloudflared...");

    const installed = await install();

    if (!installed) {
        console.log(` Automatic install failed. Install it manually: ${manualUrl}`);
        return null;
    }

    console.log(" cloudflared is ready.");
    return installed;
};
