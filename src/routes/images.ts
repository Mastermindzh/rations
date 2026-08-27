import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import {
  imageContentType,
  isAllowedImageFilename,
} from "../images/formats.js";

export function imageRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get("/images/:filename", async (c) => {
    const filename = c.req.param("filename");
    if (!isAllowedImageFilename(filename)) {
      return c.notFound();
    }
    const contentType = imageContentType(filename)!;
    try {
      const bytes = await readFile(`${dataDirectory}/images/${filename}`);
      c.header("Content-Type", contentType);
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
      if (code === "ENOENT" || code === "EACCES") {
        return c.redirect("/public/placeholder-avatar.svg", 302);
      }
      throw error;
    }
  });
  return app;
}
