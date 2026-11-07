#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { createApp } from "./server/app";
import { CliArgumentError, parseArguments, usage, type CliOptions } from "./cli/arguments";
import { links, openLink } from "./cli/links";
import { bigText, printTunnelUrl, screen } from "./cli/output";
import { startCloudflareTunnel, type CloudflareTunnelProcess } from "./tunnel/cloudflare";
import { ensureCloudflared } from "./tunnel/install";

const main = async () => {
    let options: CliOptions;

    try {
        options = parseArguments();
    } catch (error) {
        if (error instanceof CliArgumentError) {
            console.error(error.message);
            console.error(`\n${usage}`);
            process.exit(1);
        }

        throw error;
    }

    if (options.help) {
        console.log(usage);
        return;
    }

    if (options.docs) {
        const url = links[options.docs];

        console.log(` ${url}`);
        await openLink(url);
        return;
    }

    let tunnelCommand: string | undefined;

    if (options.tunnel) {
        const found = await ensureCloudflared({ yes: options.yes });

        if (found) {
            tunnelCommand = found;
        } else {
            console.log(" Continuing without a tunnel.\n");
            options.tunnel = false;
        }
    }

    const app = createApp({ sharedDir: options.sharedDir });
    let tunnelProcess: CloudflareTunnelProcess | undefined;

    bigText("K a m i o c a l");

    const server = serve({ fetch: app.fetch, port: options.port }, () => {
        screen({ sharedDir: options.sharedDir, port: options.port, showQr: !options.tunnel });

        if (!options.tunnel) return;

        console.log("\n Starting Cloudflare quick tunnel...");
        tunnelProcess = startCloudflareTunnel({
            port: options.port,
            command: tunnelCommand,
            onUrl: printTunnelUrl,
            onError: (message) => console.error(` ${message}`),
        });
    });

    process.on("SIGINT", () => {
        tunnelProcess?.stop();
        server.close(() => {
            console.log(" Server has been gently put to rest. Goodbye!");
            process.exit(0);
        });
    });
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
