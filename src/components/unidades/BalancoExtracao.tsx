/** Balanço da leitura: o usuário precisa ver a diferença entre "a convenção
 * não diz" e "o sistema não leu". */
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

export function BalancoExtracao({
  balanco,
  naoLidas = [],
  orfas = [],
}: {
  balanco: BalancoLeitura;
  naoLidas?: LinhaPendente[];
  orfas?: LinhaOrfa[];
}) {
  return (
    <div className="mt-3 w-full rounded-lg border border-border/60 bg-background/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Balanço da leitura
      </p>
      <div className="grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
        <Item rotulo="Linhas candidatas no censo" valor={String(balanco.linhas_candidatas)} />
        <Item rotulo="Lidas pelo leitor de quadros" valor={String(balanco.lidas_pelo_parser)} />
        <Item rotulo="Lidas pela IA" valor={String(balanco.lidas_pela_ia)} />
        <Item rotulo="Não lidas" valor={String(balanco.nao_lidas)} alerta={balanco.nao_lidas > 0} />
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
        <Item rotulo="Balanço fecha" valor={balanco.fecha ? "sim" : "não"} alerta={!balanco.fecha} />
      </div>

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
