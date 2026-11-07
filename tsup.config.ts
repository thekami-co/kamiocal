import { defineConfig } from "tsup";
import { cpSync, mkdirSync, rmSync } from "fs";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    clean: true,
    format: ["cjs"],
    onSuccess: async () => {
        rmSync("dist/views", { recursive: true, force: true });
        rmSync("dist/public", { recursive: true, force: true });
        cpSync("src/views", "dist/views", { recursive: true });
        mkdirSync("dist/public", { recursive: true });
        cpSync("public", "dist/public", { recursive: true });
    },
});
