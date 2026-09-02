import { existsSync } from "node:fs";

const builtModule = new URL("../dist/auth/password.js", import.meta.url);
const sourceModule = new URL("../src/auth/password.ts", import.meta.url);
const useSource =
  process.env.npm_lifecycle_event === "hash-password" &&
  existsSync(sourceModule);
const { hashPassword } = await import(
  useSource ? sourceModule.href : builtModule.href
);

let password = process.argv[2];

if (password === undefined && !process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  password = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/[\r\n]+$/, "");
}

if (!password) {
  console.error("Usage: npm run hash-password -- <password>");
  console.error("Example: npm run hash-password -- dev");
  process.exit(1);
}

console.log(await hashPassword(password));
