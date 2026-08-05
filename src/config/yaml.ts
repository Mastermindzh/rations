import { parse, stringify } from "yaml";
import { validateConfig } from "./validation.js";
import type { ValidationIssue, ValidationResult } from "./types.js";

export function parseAndValidateYaml(rawYaml: string): ValidationResult {
  let value: unknown;
  try {
    value = parse(rawYaml, { strict: true, uniqueKeys: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to parse YAML";
    const errors: ValidationIssue[] = [{ path: "yaml", message }];
    return { success: false, errors };
  }

  const result = validateConfig(value);
  if (!result.success) return result;
  return {
    success: true,
    config: result.config,
    normalizedYaml: stringify(result.config, { lineWidth: 0 }),
  };
}
