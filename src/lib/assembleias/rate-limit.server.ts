/**
 * Limite simples de requisições por IP para as rotas públicas do portal.
 * Janela deslizante em memória: 30 requisições por minuto por IP.
 */
const janelas = new Map<string, number[]>();

export function dentroDoLimite(chave: string, limite = 30, janelaMs = 60_000): boolean {
  const agora = Date.now();
  const registros = (janelas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (registros.length >= limite) {
    janelas.set(chave, registros);
    return false;
  }
  registros.push(agora);
  janelas.set(chave, registros);
  return true;
}
