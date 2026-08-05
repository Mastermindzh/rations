try {
  const response = await fetch("http://127.0.0.1:3000/health", {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) process.exit(1);
  process.exit(0);
} catch {
  process.exit(1);
}
