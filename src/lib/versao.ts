/**
 * Marcador de versão gerado em tempo de compilação.
 * Serve para conferir, olhando o site, qual build está de fato publicada.
 */
declare const __APP_BUILD_TIME__: string | undefined;

export const APP_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "dev";

/** Ex.: "11/09 13:42 UTC" — curto o bastante para o rodapé. */
export function versaoCurta(): string {
  if (APP_BUILD_TIME === "dev") return "dev";
  const d = new Date(APP_BUILD_TIME);
  if (Number.isNaN(d.getTime())) return APP_BUILD_TIME;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
