import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Content hash appended to static asset URLs so browsers refetch them on change.
function hashOf(path: string): string {
  try {
    return createHash("sha256")
      .update(readFileSync(path))
      .digest("hex")
      .slice(0, 10);
  } catch {
    return "dev";
  }
}

export const appScriptUrl = `/public/app.js?v=${hashOf(
  join(process.cwd(), "public", "app.js"),
)}`;

export const appStyleUrl = `/styles/app.css?v=${hashOf(
  join(process.cwd(), "src", "styles", "app.css"),
)}`;
