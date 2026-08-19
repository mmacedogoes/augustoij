# Plano: Acesso Restrito a Condomínios e Modo Suporte Super Admin

Implementação de restrição de acesso ao módulo de contratos para que usuários visualizem apenas seus próprios condomínios, e Super Admins tenham acesso de leitura para suporte ao visualizar condomínios de terceiros.

## Alterações de Usuário

### Acesso e Filtros
- Usuários comuns continuam acessando apenas seus condomínios (já garantido por RLS e filtros no `owner_id`).
- Super Admins agora seguem a mesma regra para uso pessoal: na área `/app/contratos`, verão apenas os condomínios que possuem.
- Super Admins ganham a capacidade de acessar o módulo de contratos em "Modo Suporte" ao navegar a partir da área administrativa.

### Modo Suporte (Super Admin)
- Ao visualizar um condomínio de outro usuário, a interface de contratos entra em modo somente-leitura.
- Botões de ação como "Novo contrato", "Importar com IA", "Salvar", "Excluir", "Anexar arquivo" e "Editar dados" serão ocultados.
- Uma faixa informativa indicará que o Super Admin está visualizando o condomínio em modo de suporte.

## Detalhes Técnicos

### Backend
1.  **`src/lib/contratos-servico/guard.ts`**:
    - Atualizar `ensureAcessoContratos` para verificar se o usuário é o dono do condomínio solicitado.
    - Se for um Super Admin acessando um condomínio que não lhe pertence, permitir acesso apenas para operações de leitura (`GET`, `POST` de listagem).
2.  **`src/lib/contratos-servico/contratos.functions.ts`**:
    - Atualizar as funções de escrita (`upsertContratoServico`, `removeContratoServico`, `upsertObrigacao`, `removeObrigacao`) para lançar erro se o Super Admin tentar modificar dados de condomínios de terceiros.
    - `listCondominiosParaContratos`: Super Admins verão apenas seus próprios condomínios por padrão, a menos que um `target_user_id` seja fornecido (contexto de suporte).

### Frontend
1.  **Contexto de Suporte**:
    - Identificar se o usuário atual é Super Admin e se o condomínio visualizado pertence a outro usuário.
2.  **`src/routes/_authenticated/app.contratos.index.tsx`**:
    - Ocultar botões "Novo contrato" e "Importar com IA" no modo suporte.
3.  **`src/routes/_authenticated/app.contratos.$contratoId.tsx`**:
    - Ocultar botões "Editar dados", "Excluir", "Analisar com Augusto" (operação de escrita/crédito) e controles de upload no modo suporte.
4.  **`src/components/AppShell.tsx`**:
    - Adicionar suporte a um parâmetro de busca ou estado global para indicar o condomínio/usuário alvo sendo suportado.

### Segurança (Supabase RLS)
- As políticas de RLS já permitem que `super_admin` visualize dados (SELECT).
- Garantir que as políticas de INSERT/UPDATE/DELETE permaneçam restritas ao `owner_id`.
