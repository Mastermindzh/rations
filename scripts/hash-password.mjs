import { randomBytes, scrypt } from "node:crypto";

let password = process.argv[2];

if (password === undefined && !process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  password = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/[\r\n]+$/, "");
}

if (!password) {
  console.error("Usage: npm run hash-password -- <password>");
  console.error("Example: npm run hash-password -- dev");
  process.exit(1);
}

const cost = 16384;
const blockSize = 8;
const parallelization = 1;
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) => {
  scrypt(
    password,
    salt,
    64,
    { N: cost, r: blockSize, p: parallelization },
    (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    },
  );
});

console.log(
  [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$"),
);
