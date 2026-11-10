#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { createApp } from "./server/app";
import { CliArgumentError, parseArguments, usage } from "./cli/arguments";
import { bigText, printTunnelUrl, screen } from "./cli/output";
import { promptPassword } from "./cli/password";
import {
  startCloudflareTunnel,
  type CloudflareTunnelProcess,
} from "./tunnel/cloudflare";

const main = async () => {
  let options;

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

  let password: string | undefined;

  if (options.password) {
    try {
      password = await promptPassword();
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Password error");
      process.exitCode = 1;
      return;
    }
  }

  const app = createApp({ sharedDir: options.sharedDir, password });
  let tunnelProcess: CloudflareTunnelProcess | undefined;

  bigText("K a m i o c a l");

  const server = serve({ fetch: app.fetch, port: options.port }, () => {
    screen({
      sharedDir: options.sharedDir,
      port: options.port,
      showQr: !options.tunnel,
    });

    if (!options.tunnel) return;

    console.log("\n Starting Cloudflare quick tunnel...");
    tunnelProcess = startCloudflareTunnel({
      port: options.port,
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

main();
