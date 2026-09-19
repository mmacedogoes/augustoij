/**
 * src/lib/extracao/normalizador.ts
 *
 * Normalizador de layout para convenções de condomínio (Bloco 1 do P15).
 * Reconstrói a estrutura de linhas do texto corrido (especialmente OCR de tabelas
 * e parágrafos sem quebra) antes de qualquer etapa de segmentação ou leitura.
 */

export function normalizarLayout(texto: string): string {
  if (!texto) return "";

  return texto
    .replace(/\r\n?/g, "\n")
    // 1. cabeçalho de escopo em qualquer posição ganha linha própria
    .replace(/[ \t]*\b((?:TORRE|BLOCO|QUADRA|SETOR|PISO|PAVIMENTO|ANDAR)[ \t]*[A-Z0-9]{1,4}[ \t]*:)/gi, "\n$1\n")
    // 2. marcador de item seguido de substantivo de unidade começa uma linha
    .replace(/[ \t]+((?:[a-z]|[ivxl]+|\d{1,3})\)[ \t]*(?:A|As|O|Os)?[ \t]*(?:unidade|apartamento|casa|lote|sala|loja|conjunto)s?\b)/gi, "\n$1")
    // Protege cabeçalhos de tabelas markdown (| col | col |\n| --- |)
    .replace(/(^|\n)([^\n|]*\|[^\n]+\|\s*)\n(\s*\|?\s*:?-{3,})/g, "$1<<<MD_HEADER>>>$2<<<END_MD_HEADER>>>\n$3")
    // 3. cada célula "| rótulo | valor |" vira uma linha de tabela
    .replace(/[ \t]*\|[ \t]*(?=[-–—]?[ \t]*[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇ])/g, "\n| ")
    // Restaura cabeçalho protegido de tabela markdown
    .replace(/<<<MD_HEADER>>>([\s\S]*?)<<<END_MD_HEADER>>>/g, (_, h) => h.replace(/\n\|\s*/g, " | "))
    // 4. dispositivos legais começam linha (Art., Artigo, Parágrafo, Cláusula, Capítulo)
    .replace(/[ \t]+(?=\b(?:Art(?:igo)?\.?[ \t]*\d|Par[áa]grafo\b|Cl[áa]usula[ \t]*\d|CAP[IÍ]TULO\b))/g, "\n")
    // 5. desfaz hifenização de fim de linha e colapsa espaços, sem tocar em quebras
    .replace(/-\n(?=[a-zà-ú])/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
