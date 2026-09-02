export function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? [value] : [];
}
