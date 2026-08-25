import { createServerFn } from "@tanstack/react-start";
import { SELECT_ASSEMBLEIA_ALIASES } from "./colunas";

export const probeFn = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: SELECT_ASSEMBLEIA_ALIASES.length };
});
