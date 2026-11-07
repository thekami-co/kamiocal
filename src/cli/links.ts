const blogUrl = "https://blog.thekami.tech/posts/kamiocal-share-folders-from-terminal/";

export const links = {
    blog: blogUrl,
    faq: `${blogUrl}#frequently-asked-questions`,
} as const;

export type LinkName = keyof typeof links;

import { spawn } from "child_process";

const isTermux = Boolean(process.env.PREFIX?.includes("com.termux"));

const openerFor = (url: string): [string, string[]] => {
    if (isTermux) return ["termux-open-url", [url]];
    if (process.platform === "win32") return ["cmd", ["/c", "start", "", url]];
    if (process.platform === "darwin") return ["open", [url]];
    return ["xdg-open", [url]];
};

export const openLink = (url: string) =>
    new Promise<boolean>((resolve) => {
        const [command, args] = openerFor(url);
        const child = spawn(command, args, { stdio: "ignore", detached: true });

        child.on("error", () => resolve(false));
        child.on("spawn", () => {
            child.unref();
            resolve(true);
        });
    });
