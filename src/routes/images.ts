import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { AppEnv } from "../env.js";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export function imageRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get("/images/:filename", async (c) => {
    const filename = c.req.param("filename");
    const extension = extname(filename).toLowerCase();
    if (
      !filename ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("..") ||
      filename.startsWith(".") ||
      !CONTENT_TYPES[extension]
    ) {
      return c.notFound();
    }
    try {
      const bytes = await readFile(`${dataDirectory}/images/${filename}`);
      c.header("Content-Type", CONTENT_TYPES[extension]);
      c.header(
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
      return c.body(bytes);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (code === "ENOENT" || code === "EACCES")
        return c.redirect("/public/placeholder-avatar.svg", 302);
      throw error;
    }
  });
  return app;
}
