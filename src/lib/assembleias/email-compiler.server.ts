import { readFileSync } from "fs";
import { join } from "path";
import { escapeHTML } from "./convocacao-mensagens";
import { paraRomano } from "./romanos";

export function compilarEmailConvocacao(data: {
  previewTexto: string;
  tipoEtiqueta: string;
  tituloCabecalho: string;
  nomeCondominio: string;
  nomeDestinatario: string;
  unidade: string;
  mensagemAbertura: string;
  dataExtenso: string;
  horario: string;
  convocacaoNumero: number;
  local: string;
  modalidade: string;
  urlEdital: string;
  urlSala?: string;
  urlVotacao?: string;
  itens: Array<{ ordem: number; titulo: string; descricao?: string; quorum: string }>;
  avisoLegal?: string;
  assinaturaNome: string;
  assinaturaCargo: string;
  ano: string;
}) {
  const templatePath = join(process.cwd(), "src/lib/assembleias/email-convocacao-assembleia-template.html");
  let html = readFileSync(templatePath, "utf-8");

  const replacements: Record<string, string> = {
    "{{PREVIEW_TEXTO}}": escapeHTML(data.previewTexto),
    "{{TIPO_ETIQUETA}}": escapeHTML(data.tipoEtiqueta),
    "{{TITULO_CABECALHO}}": escapeHTML(data.tituloCabecalho),
    "{{NOME_CONDOMINIO}}": escapeHTML(data.nomeCondominio),
    "{{NOME_DESTINATARIO}}": escapeHTML(data.nomeDestinatario),
    "{{UNIDADE}}": escapeHTML(data.unidade),
    "{{MENSAGEM_ABERTURA}}": escapeHTML(data.mensagemAbertura),
    "{{DATA_EXTENSO}}": escapeHTML(data.dataExtenso),
    "{{HORARIO}}": escapeHTML(data.horario),
    "{{CONVOCACAO_NUMERO}}": data.convocacaoNumero.toString(),
    "{{LOCAL}}": escapeHTML(data.local),
    "{{MODALIDADE}}": escapeHTML(data.modalidade),
    "{{URL_EDITAL}}": data.urlEdital,
    "{{AVISO_LEGAL}}": escapeHTML(data.avisoLegal || ""),
    "{{ASSINATURA_NOME}}": escapeHTML(data.assinaturaNome),
    "{{ASSINATURA_CARGO}}": escapeHTML(data.assinaturaCargo),
    "{{ANO}}": data.ano,
  };

  Object.entries(replacements).forEach(([key, val]) => {
    html = html.split(key).join(val);
  });

  // Blocos Condicionais
  if (data.urlSala) {
    html = html.replace("{{URL_SALA}}", data.urlSala).replace("{{URL_SALA_TEXTO}}", data.urlSala);
  } else {
    html = html.replace(/<!--BLOCO_SALA_INICIO-->[\s\S]*?<!--BLOCO_SALA_FIM-->/, "");
  }

  if (data.urlVotacao) {
    html = html.replace("{{URL_VOTACAO}}", data.urlVotacao).replace("{{URL_VOTACAO_TEXTO}}", data.urlVotacao);
  } else {
    html = html.replace(/<!--BLOCO_VOTACAO_INICIO-->[\s\S]*?<!--BLOCO_VOTACAO_FIM-->/, "");
  }

  if (!data.avisoLegal) {
    html = html.replace(/<!--BLOCO_AVISO_INICIO-->[\s\S]*?<!--BLOCO_AVISO_FIM-->/, "");
  }

  // Itens da Ordem do Dia
  const itemMatch = html.match(/<!--ITEM_INICIO-->([\s\S]*?)<!--ITEM_FIM-->/);
  if (itemMatch) {
    const itemTemplate = itemMatch[1];
    const itemsHtml = data.itens.map(item => {
      return itemTemplate
        .replace("{{ITEM_ROMANO}}", paraRomano(item.ordem))
        .replace("{{ITEM_TITULO}}", escapeHTML(item.titulo))
        .replace("{{ITEM_DESCRICAO}}", escapeHTML(item.descricao || ""))
        .replace("{{ITEM_QUORUM}}", escapeHTML(item.quorum));
    }).join("");
    html = html.replace(/<!--ITEM_INICIO-->[\s\S]*?<!--ITEM_FIM-->/, itemsHtml);
  }

  return html;
}
