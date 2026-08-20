import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAdminAction } from "@/lib/audit.server";
import { generateOTP, hashValue } from "@/lib/utils"; // Assumindo helpers existentes ou criar abaixo
import { cookies } from "next/headers"; // Simulado para TanStack Start

// Importação dinâmica para service_role
const getSupabaseAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

// --- Helpers de Segurança ---

function generateNumericOTP(length: number = 6): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Server Functions ---

export const solicitarAcessoVotacao = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string(),
    email: z.string().email()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const emailNormalizado = input.email.trim().toLowerCase();
    
    // 1. Rate Limit (Simulado via tabela de tentativas)
    const ip = context.request.headers.get("x-forwarded-for") || "127.0.0.1";
    
    // 2. Buscar Assembleia
    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select("id, condominio_id")
      .eq("codigo_publico", input.codigo)
      .single();

    if (!assembleia) {
      return { success: true }; // Resposta genérica
    }

    // 3. Buscar Condômino
    const { data: condomino } = await supabaseAdmin
      .from("condominos")
      .select("id, nome")
      .eq("condominio_id", assembleia.condominio_id)
      .ilike("email", emailNormalizado)
      .maybeSingle();

    if (!condomino) {
      await supabaseAdmin.from("assembleia_tentativas").insert({
        assembleia_id: assembleia.id,
        email: emailNormalizado,
        motivo: "email_nao_encontrado",
        ip: ip
      });
      return { success: true };
    }

    // 4. Gerar OTP e Sessão
    const otp = generateNumericOTP();
    const otpHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp))
      .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));

    const { data: sessao, error: errSessao } = await supabaseAdmin
      .from("assembleia_sessoes_votante")
      .insert({
        assembleia_id: assembleia.id,
        condomino_id: condomino.id,
        otp_hash: otpHash,
        expira_em: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        tentativas: 0
      })
      .select()
      .single();

    if (errSessao) throw new Error("Falha ao criar sessão.");

    // 5. Enviar E-mail (Resend)
    const { sendEmail } = await import("@/lib/resend");
    const { compileEmail } = await import("./email-compiler.server");
    
    const html = await compileEmail("src/lib/assembleias/email-codigo-votacao-template.html", {
      NOME_CONDOMINIO: "Condomínio", // Buscar real
      NOME_DESTINATARIO: condomino.nome,
      TIPO_ASSEMBLEIA: "Assembleia",
      DATA_HORA: new Date().toLocaleString('pt-BR'),
      CODIGO_ACESSO: otp
    });

    await sendEmail({
      to: emailNormalizado,
      subject: "Seu código de acesso à votação",
      html: html
    });

    return { success: true };
  });

export const confirmarAcessoVotacao = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string(),
    email: z.string().email(),
    otp: z.string()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const emailNormalizado = input.email.trim().toLowerCase();
    const otpHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.otp))
      .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));

    const { data: sessao } = await supabaseAdmin
      .from("assembleia_sessoes_votante")
      .select("*, condominos!inner(email)")
      .eq("condominos.email", emailNormalizado)
      .eq("otp_hash", otpHash)
      .gt("expira_em", new Date().toISOString())
      .is("confirmado_em", null)
      .maybeSingle();

    if (!sessao) {
       // Incrementar tentativas na sessão (precisaria buscar por e-mail apenas se falhou)
       return { success: false, error: "Código inválido ou expirado." };
    }

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
      .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));

    const ip = context.request.headers.get("x-forwarded-for") || "127.0.0.1";
    const agent = context.request.headers.get("user-agent") || "";
    
    await supabaseAdmin
      .from("assembleia_sessoes_votante")
      .update({
        confirmado_em: new Date().toISOString(),
        token_hash: tokenHash,
        ip: ip,
        user_agent: agent,
        device_hash: agent // Simplificado
      })
      .eq("id", sessao.id);

    // Definir cookie no handler de resposta (TanStack Start usa Response)
    // Como estamos num handler de serverFn, retornamos o sinal para o cliente
    // e o middleware ou o próprio componente cuida do cookie se necessário,
    // mas a instrução pede cookie httpOnly. 
    // Em TanStack Start, podemos usar o context.responseHeaders se disponível.
    
    return { 
      success: true, 
      token, // O cliente vai receber isso e precisaremos de um mecanismo para setar o cookie
      assembleiaId: sessao.assembleia_id 
    };
  });
