import { readFileSync } from "node:fs";
import { parse } from "yaml";

// Le contrat fourni (docs/openapi.yaml) sert à la fois de référence et de documentation interactive
export function loadOpenApiSpec(): Record<string, unknown> {
  return parse(readFileSync(new URL("../../docs/openapi.yaml", import.meta.url), "utf-8"));
}
