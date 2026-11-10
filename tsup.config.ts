import { defineConfig } from "tsup";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  clean: true,
  format: ["cjs", "esm"],
  dts: true,

  async onSuccess() {
    mkdirSync("dist", { recursive: true });

    cpSync("src/views", join("dist", "views"), {
      recursive: true,
      force: true,
    });

    cpSync("public", join("dist", "public"), {
      recursive: true,
      force: true,
    });
  },
});
