import { supabaseAdmin } from @/integrations/supabase/client.server;
import { CONDOMINIOS_VERSARI_SEED } from @/config/seed-condominios-versari;

export const MARCELO_EMAIL = marcelo@versari.com.br;

/**
 * Garante que a carteira de condominios do Marcelo Versari esta sincronizada.
 * Regra de seguranca estrita: Condominios existentes NUNCA sao modificados nem substituidos,
 * apenas ignorados.
 */
export async function sincronizarCarteiraMarceloSeNecessario(userId: string) {
  try {
    // 1. Identificar se o usuario e o Marcelo ou pertence a equipe do Marcelo
    const { data: profile } = await supabaseAdmin
      .from(profiles)
      .select(id, email)
      .eq(id, userId)
      .maybeSingle();

    let marceloId: string | null = null;

    if (profile?.email?.toLowerCase() === MARCELO_EMAIL) {
      marceloId = userId;
    } else {
      // Verifica se o usuario e membro da equipe do Marcelo
      const { data: memberOfMarcelo } = await supabaseAdmin
        .from(condominio_members)
        .select(criado_por)
        .eq(user_id, userId)
        .not(criado_por, is, null)
        .limit(1)
        .maybeSingle();

      if (memberOfMarcelo?.criado_por) {
        const { data: masterProfile } = await supabaseAdmin
          .from(profiles)
          .select(id, email)
          .eq(id, memberOfMarcelo.criado_por)
          .maybeSingle();
        if (masterProfile?.email?.toLowerCase() === MARCELO_EMAIL) {
          marceloId = masterProfile.id;
        }
      }
    }

    // Se nao for Marcelo nem membro de sua equipe, busca se Marcelo ja existe no banco
    if (!marceloId) {
      const { data: marceloProfile } = await supabaseAdmin
        .from(profiles)
        .select(id)
        .eq(email, MARCELO_EMAIL)
        .maybeSingle();
      if (marceloProfile?.id) {
        marceloId = marceloProfile.id;
      }
    }

    if (!marceloId) return;

    // 2. Buscar condominios ja existentes de Marcelo para nao duplicar/substituir
    const { data: existentes } = await supabaseAdmin
      .from(condominios)
      .select(id, nome, cnpj)
      .eq(owner_id, marceloId);

    const nomesExistentes = new Set(
      (existentes ?? []).map((c) => c.nome.trim().toLowerCase()),
    );
    const cnpjsExistentes = new Set(
      (existentes ?? [])
        .filter((c) => Boolean(c.cnpj))
        .map((c) => (c.cnpj || ").replace(/\D/g, )),
 );

 // 3. Filtrar apenas os que ainda nao estao cadastrados
 const novosParaInserir = CONDOMINIOS_VERSARI_SEED.filter((seed) => {
 const nomeKey = seed.nome.trim().toLowerCase();
 const cnpjKey = seed.cnpj.replace(/\D/g, );
 if (nomesExistentes.has(nomeKey)) return false;
 if (cnpjKey && cnpjsExistentes.has(cnpjKey)) return false;
 return true;
 }).map((seed) => ({
 owner_id: marceloId as string,
 nome: seed.nome,
 cnpj: seed.cnpj,
 categoria: seed.categoria,
 uf: seed.uf,
 cidade: seed.cidade,
 }));

 if (novosParaInserir.length > 0) {
 await supabaseAdmin.from(condominios).insert(novosParaInserir);
 }

 // 4. Compartilhar com todos os membros da equipe de Marcelo
 const { data: membrosEquipe } = await supabaseAdmin
 .from(condominio_members)
 .select(user_id)
 .eq(criado_por, marceloId);

 const equipeIds = Array.from(
 new Set(
 (membrosEquipe ?? [])
 .map((m) => m.user_id)
 .filter((id) => id !== marceloId),
 ),
 );

 if (equipeIds.length > 0) {
 const { data: todosCondos } = await supabaseAdmin
 .from(condominios)
 .select(id)
 .eq(owner_id, marceloId);

 if (todosCondos && todosCondos.length > 0) {
 const vinculos = [];
 for (const membroId of equipeIds) {
 for (const condo of todosCondos) {
 vinculos.push({
 condominio_id: condo.id,
 user_id: membroId,
 criado_por: marceloId,
 papel: sindico,
 pode_gerenciar_contratos: true,
 pode_gerenciar_documentos: true,
 pode_gerenciar_assembleias: true,
 pode_gerenciar_unidades: true,
 pode_gerenciar_usuarios: true,
 });
 }
 }
 await supabaseAdmin
 .from(condominio_members)
 .upsert(vinculos, { onConflict: condominio_id,user_id, ignoreDuplicates: true });
 }
 }
 } catch (err) {
 console.error([seed-versari] Erro na sincronizacao automatica:, err);
 }
}
