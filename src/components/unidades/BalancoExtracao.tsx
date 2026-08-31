/** Balanço da leitura: o usuário precisa ver a diferença entre "a convenção
 * não diz" e "o sistema não leu". */
import type { BalancoDescritivo, Conferencia } from "@/lib/convencao-descritiva";

export type BalancoLeitura = {
  linhas_candidatas: number;
  lidas_pelo_parser: number;
  lidas_pela_ia: number;
  nao_lidas: number;
  unidades_resolvidas: number;
  sem_correspondencia: number;
  soma_fracoes: number;
  fecha: boolean;
};

export type LinhaPendente = { linha_id?: string | null; texto: string; pagina: number | null };
export type LinhaOrfa = LinhaPendente & { numero: string; bloco: string | null };

const formatarFracao = (valor: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });

function Item({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span
        className={`font-mono tabular-nums ${alerta ? "text-destructive font-semibold" : "font-medium"}`}
      >
        {valor}
      </span>
    </div>
  );
}

const ROTULO_CONFERENCIA: Record<string, string> = {
  soma_fracoes: "(a) soma das frações = 1",
  fracao_igual_equivalente_rateada: "(b) fração = equivalente rateada",
  total_igual_privativa_comum_vagas: "(c) total = priv + comum + vagas",
  vagas_declaradas: "(d) vagas somadas = declaradas",
};

export function BalancoExtracao({
  balanco,
  balancoDescritivo,
  tentativa,
  conferencias = [],
  naoLidas = [],
  orfas = [],
}: {
  balanco?: BalancoLeitura | null;
  balancoDescritivo?: BalancoDescritivo | null;
  tentativa?: TentativaDescritiva | null;
  conferencias?: Conferencia[];
  naoLidas?: LinhaPendente[];
  orfas?: LinhaOrfa[];
}) {
  const d = balancoDescritivo;
  return (
    <div className="mt-3 w-full rounded-lg border border-border/60 bg-background/60 p-3">
      {tentativa && (
        <div className="mb-3 rounded-md border border-border/60 p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tentativa de leitura da seção descritiva
          </p>
          <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
            <Item
              rotulo="Rol do Artigo 2 localizado"
              valor={tentativa.rol_localizado ? "sim" : "não"}
              alerta={!tentativa.rol_localizado}
            />
            <Item
              rotulo="Identificadores no rol"
              valor={String(tentativa.identificadores_no_rol)}
            />
            <Item
              rotulo="Blocos descritivos"
              valor={String(tentativa.blocos_descritivos)}
              alerta={tentativa.blocos_descritivos === 0}
            />
            <Item rotulo="Unidades após expansão" valor={String(tentativa.unidades_apos_expansao)} />
            <Item rotulo="Com área privativa" valor={String(tentativa.com_area_privativa)} />
            <Item rotulo="Com fração ideal" valor={String(tentativa.com_fracao_ideal)} />
            <Item
              rotulo={`Soma das frações (escala ${tentativa.escala_aplicada})`}
              valor={formatarFracao(tentativa.soma_fracoes)}
              alerta={!tentativa.soma_ok}
            />
            <Item
              rotulo="Caminho usado"
              valor={
                tentativa.caminho_usado === "secao_descritiva"
                  ? "seção descritiva"
                  : "censo de linhas"
              }
              alerta={tentativa.caminho_usado !== "secao_descritiva"}
            />
          </div>
          {tentativa.motivo_descarte && (
            <p className="mt-1 text-xs text-destructive">
              Motivo: {tentativa.motivo_descarte}
            </p>
          )}
          {tentativa.amostras?.some((a) => a.ocorrencias.length > 0) && (
            <div className="mt-2 space-y-1">
              {tentativa.amostras.map((a) => (
                <div key={a.termo} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{a.termo}</span>
                  {a.ocorrencias.length === 0 ? (
                    <span> — não aparece no texto indexado</span>
                  ) : (
                    <ul className="mt-0.5 space-y-0.5">
                      {a.ocorrencias.map((o, i) => (
                        <li key={i} className="font-mono">
                          …{o}…
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Balanço da leitura
      </p>

      {d ? (
        <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
          <Item
            rotulo="Identificadores no rol do Artigo 2"
            valor={String(d.identificadores_no_rol)}
          />
          <Item rotulo="Blocos descritivos encontrados" valor={String(d.blocos_descritivos)} />
          <Item rotulo="Unidades após expansão" valor={String(d.unidades_apos_expansao)} />
          <Item rotulo="Casadas com o rol" valor={String(d.casadas_com_o_rol)} />
          <Item rotulo="Não lidas" valor={String(d.nao_lidas)} alerta={d.nao_lidas > 0} />
          <Item
            rotulo="Soma das frações"
            valor={formatarFracao(d.soma_fracoes)}
            alerta={Math.abs(d.soma_fracoes - 1) > 0.005}
          />
          <Item
            rotulo="Fração = equivalente rateada"
            valor={`${d.fracao_equivalente_ok} de ${d.unidades_apos_expansao}`}
            alerta={d.fracao_equivalente_ok < d.unidades_apos_expansao}
          />
          <Item
            rotulo={`Total = priv + comum + vagas × ${d.constante_vaga != null ? d.constante_vaga.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "?"}`}
            valor={`${d.total_vagas_ok} de ${d.unidades_apos_expansao}`}
            alerta={d.total_vagas_ok < d.unidades_apos_expansao}
          />
          <Item rotulo="Balanço fecha" valor={d.fecha ? "sim" : "não"} alerta={!d.fecha} />
        </div>
      ) : balanco ? (
        <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">

          <Item rotulo="Linhas candidatas no censo" valor={String(balanco.linhas_candidatas)} />
          <Item rotulo="Lidas pelo leitor de quadros" valor={String(balanco.lidas_pelo_parser)} />
          <Item rotulo="Lidas pela IA" valor={String(balanco.lidas_pela_ia)} />
          <Item
            rotulo="Não lidas"
            valor={String(balanco.nao_lidas)}
            alerta={balanco.nao_lidas > 0}
          />
          <Item rotulo="Unidades resolvidas" valor={String(balanco.unidades_resolvidas)} />
          <Item
            rotulo="Sem correspondência no cadastro"
            valor={String(balanco.sem_correspondencia)}
            alerta={balanco.sem_correspondencia > 0}
          />
          <Item
            rotulo="Soma das frações"
            valor={formatarFracao(balanco.soma_fracoes)}
            alerta={Math.abs(balanco.soma_fracoes - 1) > 0.005}
          />
          <Item
            rotulo="Balanço fecha"
            valor={balanco.fecha ? "sim" : "não"}
            alerta={!balanco.fecha}
          />
        </div>
      )}

      {conferencias.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Conferências do documento</p>
          <ul className="mt-1 space-y-1">
            {conferencias.map((c) => (
              <li key={c.regra} className="text-xs">
                <span className={c.ok ? "text-muted-foreground" : "text-destructive font-medium"}>
                  {c.ok ? "✓" : "✕"} {ROTULO_CONFERENCIA[c.regra] ?? c.regra}
                </span>
                {c.detalhe ? <span className="text-muted-foreground"> — {c.detalhe}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}


      {naoLidas.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-destructive">
            Linhas que o sistema não conseguiu ler ({naoLidas.length})
          </p>
          <ul className="mt-1 space-y-1">
            {naoLidas.slice(0, 20).map((linha, i) => (
              <li key={linha.linha_id ?? i} className="text-xs text-muted-foreground">
                <span className="font-mono">p.{linha.pagina ?? "?"}</span> — {linha.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {orfas.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Linhas sem unidade correspondente no cadastro ({orfas.length}) — atribua manualmente na
            revisão
          </p>
          <ul className="mt-1 space-y-1">
            {orfas.slice(0, 20).map((linha, i) => (
              <li key={linha.linha_id ?? i} className="text-xs text-muted-foreground">
                <span className="font-mono">
                  p.{linha.pagina ?? "?"} · {linha.bloco ?? "—"}/{linha.numero}
                </span>{" "}
                — {linha.texto}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
