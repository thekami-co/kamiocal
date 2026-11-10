import { Hono } from "hono";
import type { Context } from "hono";
import ejs from "ejs";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { readDirectory } from "./directoryListing";
import { publicAssetCache, serveFile, sharedFileCache } from "./fileResponse";
import { resolveRequestPath } from "./requestPath";
import { createAuth } from "./auth";

export interface AppOptions {
  sharedDir: string;
  publicDir?: string;
  viewsDir?: string;
  password?: string;
}

export const createApp = ({
  sharedDir,
  publicDir = join(__dirname, "public"),
  viewsDir = join(__dirname, "views"),
  password,
}: AppOptions) => {
  const app = new Hono();
  const auth = password !== undefined ? createAuth(password) : undefined;
  const indexView = join(viewsDir, "index.ejs");
  let renderIndex: ejs.TemplateFunction | undefined;

  const renderDirectory = (filePath: string, requestPath: string) => {
    if (!renderIndex) {
      renderIndex = ejs.compile(readFileSync(indexView, "utf8"), {
        filename: indexView,
        cache: false,
      });
    }

    return renderIndex({ data: readDirectory(filePath, requestPath) });
  };

  const publicAssetHandler = (c: Context) => {
    const resolvedPath = resolveRequestPath(publicDir, c.req.path);

    if (!resolvedPath) return c.text("Not found", 404);

    try {
      const stats = statSync(resolvedPath.filePath);

      if (!stats.isFile()) return c.text("Not found", 404);

      return serveFile(c, resolvedPath.filePath, stats, publicAssetCache);
    } catch {
      return c.text("Not found", 404);
    }
  };

  const sharedPathHandler = (c: Context) => {
    const resolvedPath = resolveRequestPath(sharedDir, c.req.path);

    if (!resolvedPath) return c.text("Not found", 404);

    try {
      const stats = statSync(resolvedPath.filePath);

      if (stats.isFile())
        return serveFile(c, resolvedPath.filePath, stats, sharedFileCache);
      if (!stats.isDirectory()) return c.text("Not found", 404);

      c.header("Cache-Control", "no-store");
      return c.html(
        renderDirectory(resolvedPath.filePath, resolvedPath.requestPath),
      );
    } catch {
      return c.text("Not found", 404);
    }
  };

  app.get("/styles/*", publicAssetHandler);
  app.on("HEAD", "/styles/*", publicAssetHandler);
  app.get("/icons/*", publicAssetHandler);
  app.on("HEAD", "/icons/*", publicAssetHandler);

  if (auth) {
    const loginView = join(viewsDir, "login.ejs");

    const loginTemplate = ejs.compile(readFileSync(loginView, "utf8"), {
      filename: loginView,
    });

    const renderLogin = (error = false) => {
      return loginTemplate({ error });
    };

    // GET: /login
    app.get("/login", (c) => {
      c.header("Cache-Control", "no-store");
      return c.html(renderLogin());
    });

    // POST: /login
    app.post("/login", async (c) => {
      c.header("Cache-Control", "no-store");

      const contentType = c.req.header("content-type") ?? "";

      if (
        !contentType
          .toLowerCase()
          .startsWith("application/x-www-form-urlencoded")
      ) {
        return c.text("Unsupported Media Type", 415);
      }

      const body = await c.req.parseBody();
      const attempt = body.password;

      if (typeof attempt !== "string") {
        return c.text("Invalid password input", 400);
      }

      if (auth.login(c, attempt)) {
        return c.redirect("/", 303);
      }

      return c.html(renderLogin(true), 401);
    });

    // POST: /logout
    app.post("/logout", (c) => {
      auth.logout(c);
      return c.redirect("/login", 303);
    });

    app.use("*", auth.middleware);
  }

  app.get("*", sharedPathHandler);
  app.on("HEAD", "*", sharedPathHandler);

  return app;
};
