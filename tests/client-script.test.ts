import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("browser script", () => {
  it("parses as JavaScript", async () => {
    const source = await readFile(new URL("../public/app.js", import.meta.url), {
      encoding: "utf8",
    });

    expect(() => new Function(source)).not.toThrow();
  });
});
