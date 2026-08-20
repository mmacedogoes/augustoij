import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface CompilarParams {
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
  itens: Array<{
    ordem: number;
    titulo: string;
    descricao?: string;
    quorum: string;
  }>;
  assinaturaNome: string;
  assinaturaCargo: string;
  ano: string;
}

/**
 * Compila o template HTML de convocação substituindo as variáveis.
 */
export async function compilarEmailConvocacao(params: CompilarParams): Promise<string> {
  // Em um ambiente real, leríamos o arquivo do bucket ou filesystem
  // Como estamos no worker, vamos usar o template que subimos
  
  try {
    // Tenta ler o arquivo localmente primeiro (se estiver no bundle)
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    
    // Caminho relativo ao projeto
    const templatePath = join(process.cwd(), "src/lib/assembleias/email-convocacao-assembleia-template.html");
    let html = readFileSync(templatePath, "utf-8");

    const itensHtml = params.itens.map(item => `
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f7; border-left: 4px solid #C5A47E;">
        <h4 style="margin: 0 0 5px 0; color: #1a1a1a; font-family: 'Cormorant Garamond', serif; font-size: 18px;">
          ${item.ordem}. ${item.titulo}
        </h4>
        ${item.descricao ? `<p style="margin: 5px 0; font-size: 14px; color: #666;">${item.descricao}</p>` : ''}
        <span style="font-size: 12px; color: #C5A47E; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
          Quórum: ${item.quorum}
        </span>
      </div>
    `).join("");

    const placeholders: Record<string, string> = {
      "{{previewTexto}}": params.previewTexto,
      "{{tipoEtiqueta}}": params.tipoEtiqueta,
      "{{tituloCabecalho}}": params.tituloCabecalho,
      "{{nomeCondominio}}": params.nomeCondominio,
      "{{nomeDestinatario}}": params.nomeDestinatario,
      "{{unidade}}": params.unidade,
      "{{mensagemAbertura}}": params.mensagemAbertura,
      "{{dataExtenso}}": params.dataExtenso,
      "{{horario}}": params.horario,
      "{{convocacaoNumero}}": params.convocacaoNumero.toString(),
      "{{local}}": params.local,
      "{{modalidade}}": params.modalidade === 'presencial' ? 'Presencial' : params.modalidade === 'virtual' ? 'Virtual' : 'Híbrida',
      "{{urlEdital}}": params.urlEdital,
      "{{itensOrdemDoDia}}": itensHtml,
      "{{assinaturaNome}}": params.assinaturaNome,
      "{{assinaturaCargo}}": params.assinaturaCargo,
      "{{ano}}": params.ano
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      html = html.split(key).join(value);
    });

    return html;
  } catch (error) {
    console.error("Erro ao compilar email:", error);
    // Fallback simples caso o arquivo não seja encontrado
    return `<h1>Convocação: ${params.nomeCondominio}</h1><p>Olá ${params.nomeDestinatario}, você está convocado...</p>`;
  }
}

interface CompilarVotacaoParams {
  PREVIEW_TEXTO: string;
  NOME_CONDOMINIO: string;
  NOME_DESTINATARIO: string;
  TIPO_ASSEMBLEIA: string;
  DATA_HORA: string;
  CODIGO_ACESSO: string;
}

export async function compilarEmailVotacao(params: CompilarVotacaoParams): Promise<string> {
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const templatePath = join(process.cwd(), "src/lib/assembleias/email-codigo-votacao-template.html");
    let html = readFileSync(templatePath, "utf-8");

    const placeholders: Record<string, string> = {
      "{{PREVIEW_TEXTO}}": params.PREVIEW_TEXTO,
      "{{NOME_CONDOMINIO}}": params.NOME_CONDOMINIO,
      "{{NOME_DESTINATARIO}}": params.NOME_DESTINATARIO,
      "{{TIPO_ASSEMBLEIA}}": params.TIPO_ASSEMBLEIA,
      "{{DATA_HORA}}": params.DATA_HORA,
      "{{CODIGO_ACESSO}}": params.CODIGO_ACESSO
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      html = html.split(key).join(value);
    });

    return html;
  } catch (error) {
    console.error("Erro ao compilar email de votação:", error);
    return `Seu código de acesso à votação é: ${params.CODIGO_ACESSO}`;
  }
}
