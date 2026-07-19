import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText, Download, Save, Wallet } from "lucide-react";
import {
  getDadosAditivo,
  salvarAditivo,
  getAditivoSignedUrl,
} from "@/lib/imoveis/aditivos.functions";
import { lancarHonorarioRenovacao } from "@/lib/imoveis/honorarios.functions";
import { formatBRL, parseBRL } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/locacao/$id/aditivo")({
  component: GerarAditivo,
});

type Form = {
  // proprietário
  loc_nome: string;
  loc_nacionalidade: string;
  loc_estado_civil: string;
  loc_profissao: string;
  loc_rg: string;
  loc_cpf: string;
  loc_endereco: string;
  // inquilino
  inq_nome: string;
  inq_nacionalidade: string;
  inq_estado_civil: string;
  inq_profissao: string;
  inq_rg: string;
  inq_cpf: string;
  inq_endereco: string;
  // imóvel
  imv_descricao: string;
  imv_edificio: string;
  imv_endereco: string;
  imv_cep: string;
  imv_comodos: string;
  // contrato
  data_contrato_original: string;
  data_assinatura: string;
  prazo_meses: number;
  aviso_previo_dias: number;
  multa_rescisoria_multiplicador: number;
  valor_aluguel: number;
  valor_aluguel_extenso: string;
  dia_vencimento: number;
  indice_reajuste: string;
  multa_mora_percent: number;
  juros_mora_mensal_percent: number;
  caucao_valor: number;
  caucao_texto: string;
  foro: string;
  // cláusulas editáveis
  cl_consideracoes: string;
  cl_objeto: string;
  cl_prazo: string;
  cl_preco: string;
  cl_reajuste: string;
  cl_encargos: string;
  cl_mora: string;
  cl_utilizacao: string;
  cl_garantia: string;
  cl_disposicoes: string;
};

function numeroPorExtenso(v: number): string {
  // Placeholder simples — o usuário edita antes de exportar.
  return `R$ ${formatBRL(v)}`;
}

function GerarAditivo() {
  const { id } = Route.useParams();
  const carregar = useServerFn(getDadosAditivo);
  const salvar = useServerFn(salvarAditivo);
  const signedUrl = useServerFn(getAditivoSignedUrl);
  const lancarHon = useServerFn(lancarHonorarioRenovacao);

  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ultimoPath, setUltimoPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const c = await carregar({ data: { contratoLocacaoId: id } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imv: any = (c as any).imoveis ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prop: any = imv.proprietarios ?? {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cau: any = Array.isArray((c as any).caucoes) ? (c as any).caucoes[0] : (c as any).caucoes;
      const valorAluguel = Number(c.valor_aluguel ?? 0);
      const hoje = new Date().toISOString().slice(0, 10);
      const endImovel = [imv.endereco, imv.numero_unidade, imv.cidade, imv.uf, imv.cep]
        .filter(Boolean).join(", ");
      const caucaoVal = Number(cau?.valor_atual_override ?? cau?.valor_depositado ?? 0);
      const f: Form = {
        loc_nome: prop.nome ?? "",
        loc_nacionalidade: "brasileira",
        loc_estado_civil: prop.estado_civil ?? "",
        loc_profissao: prop.profissao ?? "",
        loc_rg: prop.rg ?? "",
        loc_cpf: prop.cpf ?? "",
        loc_endereco: prop.endereco ?? "",
        inq_nome: c.inquilino_nome ?? "",
        inq_nacionalidade: "brasileira",
        inq_estado_civil: c.inquilino_estado_civil ?? "",
        inq_profissao: c.inquilino_profissao ?? "",
        inq_rg: c.inquilino_rg ?? "",
        inq_cpf: c.inquilino_cpf ?? "",
        inq_endereco: c.inquilino_endereco ?? "",
        imv_descricao: imv.descricao ?? "",
        imv_edificio: imv.edificio ?? "",
        imv_endereco: endImovel,
        imv_cep: imv.cep ?? "",
        imv_comodos:
          [imv.quartos ? `${imv.quartos} quartos` : null, imv.area ? `${imv.area} m²` : null, imv.vaga_garagem ? "vaga de garagem" : null]
            .filter(Boolean).join(", ") || "sala, cozinha, banheiro e demais dependências",
        data_contrato_original: c.data_contrato_original ?? "",
        data_assinatura: hoje,
        prazo_meses: Number(c.prazo_meses ?? 30),
        aviso_previo_dias: Number(c.aviso_previo_dias ?? 30),
        multa_rescisoria_multiplicador: Number(c.multa_rescisoria_multiplicador ?? 3),
        valor_aluguel: valorAluguel,
        valor_aluguel_extenso: numeroPorExtenso(valorAluguel),
        dia_vencimento: Number(c.dia_vencimento ?? 5),
        indice_reajuste: c.indice_reajuste ?? "IGP-M",
        multa_mora_percent: Number(c.multa_mora_percent ?? 2),
        juros_mora_mensal_percent: Number(c.juros_mora_mensal_percent ?? 1),
        caucao_valor: caucaoVal,
        caucao_texto: caucaoVal > 0 ? `caução em espécie no valor de R$ ${formatBRL(caucaoVal)}` : "sem caução",
        foro: c.foro ?? "Comarca da Capital do Estado de São Paulo",
        cl_consideracoes: "",
        cl_objeto: "",
        cl_prazo: "",
        cl_preco: "",
        cl_reajuste: "",
        cl_encargos: "",
        cl_mora: "",
        cl_utilizacao: "",
        cl_garantia: "",
        cl_disposicoes: "",
      };
      // Gera textos padrão das cláusulas a partir dos dados.
      f.cl_consideracoes =
        `CONSIDERANDO que a LOCADORA é legítima proprietária do imóvel objeto do presente instrumento; ` +
        `CONSIDERANDO que as partes firmaram o contrato original de locação em ${f.data_contrato_original || "___/___/______"}; ` +
        `CONSIDERANDO o interesse mútuo em renovar a locação, resolvem celebrar o presente Termo de Renovação, mediante as cláusulas e condições a seguir.`;
      f.cl_objeto =
        `CLÁUSULA 1ª – DO OBJETO. O presente termo tem por objeto a RENOVAÇÃO da locação do imóvel ` +
        `${f.imv_descricao}${f.imv_edificio ? `, situado no Edifício ${f.imv_edificio}` : ""}, ` +
        `localizado em ${f.imv_endereco}${f.imv_cep ? `, CEP ${f.imv_cep}` : ""}. ` +
        `Parágrafo único: o imóvel é composto por ${f.imv_comodos}.`;
      f.cl_prazo =
        `CLÁUSULA 2ª – DO PRAZO. A locação fica renovada pelo prazo de ${f.prazo_meses} (___) meses, ` +
        `a contar da data de assinatura deste termo. Fica ajustado aviso prévio de ${f.aviso_previo_dias} dias em caso de desinteresse na continuidade da locação. ` +
        `Em caso de rescisão antecipada pelo LOCATÁRIO, será devida multa equivalente a ${f.multa_rescisoria_multiplicador} (___) alugueres, proporcional ao período faltante para o término do contrato.`;
      f.cl_preco =
        `CLÁUSULA 3ª – DO PREÇO. O valor mensal do aluguel fica ajustado em R$ ${formatBRL(f.valor_aluguel)} (${f.valor_aluguel_extenso}), ` +
        `a ser pago diretamente na conta bancária de titularidade da LOCADORA, com vencimento todo dia ${f.dia_vencimento} de cada mês. ` +
        `Parágrafo único: caso o dia do vencimento recaia em sábado, domingo ou feriado, o pagamento será adiado para o primeiro dia útil subsequente, sem incidência de encargos.`;
      f.cl_reajuste =
        `CLÁUSULA 4ª – DO REAJUSTE. O valor do aluguel será reajustado anualmente pela variação acumulada do ${f.indice_reajuste} no período. ` +
        `Caso o índice apure resultado negativo, o valor do aluguel permanecerá inalterado no período correspondente.`;
      f.cl_encargos =
        `CLÁUSULA 5ª – DOS ENCARGOS. Correrão por conta exclusiva do LOCATÁRIO as despesas de condomínio, água, energia elétrica, IPTU e TCR (taxa de coleta de resíduos), ` +
        `bem como quaisquer outros tributos e taxas incidentes sobre a utilização do imóvel durante a vigência da locação.`;
      f.cl_mora =
        `CLÁUSULA 6ª – DA MORA. O atraso no pagamento do aluguel e demais encargos sujeitará o LOCATÁRIO à multa de ${f.multa_mora_percent}% ` +
        `sobre o valor devido, acrescida de juros moratórios de ${f.juros_mora_mensal_percent}% ao mês, calculados pro rata die, além de correção monetária.`;
      f.cl_utilizacao =
        `CLÁUSULA 7ª – DA UTILIZAÇÃO E BENFEITORIAS. O LOCATÁRIO obriga-se a utilizar o imóvel exclusivamente para fins residenciais, mantendo-o em perfeito estado de conservação. ` +
        `As benfeitorias necessárias serão indenizáveis; as úteis somente se previamente autorizadas por escrito pela LOCADORA; e as voluptuárias jamais serão indenizadas, podendo ser levantadas ao final desde que não danifiquem o imóvel. ` +
        `Ao final da locação será realizada vistoria comparativa com a vistoria inicial, devendo o imóvel ser restituído no mesmo estado em que foi recebido.`;
      f.cl_garantia =
        `CLÁUSULA 8ª – DA GARANTIA LOCATÍCIA. A garantia da presente locação é constituída por ${f.caucao_texto}, que permanecerá em poder da LOCADORA até o final da locação, ` +
        `podendo ser utilizada para quitação de eventuais débitos, danos ou pendências apurados na vistoria final.`;
      f.cl_disposicoes =
        `CLÁUSULA 9ª – DAS DISPOSIÇÕES GERAIS. Ficam mantidas todas as demais cláusulas e condições do contrato original que não conflitem com o presente termo. ` +
        `Aplica-se à presente locação a Lei nº 8.245/91 e legislação correlata. O presente instrumento constitui título executivo extrajudicial, nos termos do art. 784 do CPC. ` +
        `Fica eleito o foro da ${f.foro} para dirimir quaisquer questões oriundas deste instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.`;
      setForm(f);
    })().catch((e) => toast.error(e.message));
  }, [id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const documento = useMemo(() => {
    if (!form) return "";
    const qual = (label: string, o: {
      nome: string; nacionalidade: string; estado_civil: string; profissao: string;
      rg: string; cpf: string; endereco: string;
    }) =>
      `${label}: ${o.nome}, ${o.nacionalidade}, ${o.estado_civil}, ${o.profissao}, portador(a) do RG nº ${o.rg} e inscrito(a) no CPF sob o nº ${o.cpf}, residente e domiciliado(a) em ${o.endereco}.`;
    return [
      "TERMO DE RENOVAÇÃO DE CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL",
      "",
      qual("LOCADORA", {
        nome: form.loc_nome, nacionalidade: form.loc_nacionalidade,
        estado_civil: form.loc_estado_civil, profissao: form.loc_profissao,
        rg: form.loc_rg, cpf: form.loc_cpf, endereco: form.loc_endereco,
      }),
      "",
      qual("LOCATÁRIO(A)", {
        nome: form.inq_nome, nacionalidade: form.inq_nacionalidade,
        estado_civil: form.inq_estado_civil, profissao: form.inq_profissao,
        rg: form.inq_rg, cpf: form.inq_cpf, endereco: form.inq_endereco,
      }),
      "",
      form.cl_consideracoes,
      "",
      form.cl_objeto,
      "",
      form.cl_prazo,
      "",
      form.cl_preco,
      "",
      form.cl_reajuste,
      "",
      form.cl_encargos,
      "",
      form.cl_mora,
      "",
      form.cl_utilizacao,
      "",
      form.cl_garantia,
      "",
      form.cl_disposicoes,
      "",
      `Local e data: ______________________, ${form.data_assinatura}.`,
      "",
      "",
      "____________________________________________",
      `LOCADORA — ${form.loc_nome}`,
      "",
      "____________________________________________",
      `LOCATÁRIO(A) — ${form.inq_nome}`,
      "",
      "Testemunhas:",
      "",
      "1) ____________________________________  Nome:                              CPF:",
      "",
      "2) ____________________________________  Nome:                              CPF:",
    ].join("\n");
  }, [form]);

  function gerarPdf(): { doc: jsPDF; base64: string } {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 56;
    const marginY = 64;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - marginX * 2;

    doc.setFont("times", "bold");
    doc.setFontSize(13);
    const titulo = "TERMO DE RENOVAÇÃO DE CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL";
    const tituloLinhas = doc.splitTextToSize(titulo, usableWidth);
    doc.text(tituloLinhas, pageWidth / 2, marginY, { align: "center" });

    let y = marginY + tituloLinhas.length * 16 + 16;
    doc.setFont("times", "normal");
    doc.setFontSize(11);

    const paragrafos = documento.split("\n").slice(2); // remove título já desenhado
    for (const p of paragrafos) {
      if (p.trim() === "") { y += 8; continue; }
      const linhas = doc.splitTextToSize(p, usableWidth);
      for (const l of linhas) {
        if (y > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
        doc.text(l, marginX, y, { align: "justify", maxWidth: usableWidth });
        y += 15;
      }
      y += 4;
    }

    const base64 = doc.output("datauristring");
    return { doc, base64 };
  }

  async function baixarPdf() {
    const { doc } = gerarPdf();
    doc.save(`termo-renovacao-${id.slice(0, 8)}.pdf`);
  }

  async function salvarNoStorage() {
    if (!form) return;
    setSalvando(true);
    try {
      const { base64 } = gerarPdf();
      const res = await salvar({
        data: {
          contratoLocacaoId: id,
          dados: form as unknown as Record<string, unknown>,
          pdfBase64: base64,
        },
      });
      setUltimoPath(res.path);
      toast.success("Aditivo gerado e salvo.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function abrirSalvo() {
    if (!ultimoPath) return;
    const { url } = await signedUrl({ data: { path: ultimoPath } });
    window.open(url, "_blank");
  }

  async function lancarHonorario() {
    if (!form) return;
    try {
      const res = await lancarHon({
        data: {
          contratoLocacaoId: id,
          novoAluguel: form.valor_aluguel,
          dataReferencia: form.data_assinatura,
        },
      });
      toast.success(`Honorário de renovação lançado (R$ ${formatBRL(res.valor)}).`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppShell>
      <AdminNav />
      <ImoveisNav />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/app/admin/imoveis/locacao/$id" params={{ id }}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar ao painel</Button>
          </Link>
          <h1 className="text-xl font-semibold">Gerar termo de renovação</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={baixarPdf} disabled={!form}>
            <Download className="h-4 w-4 mr-1" />Baixar PDF
          </Button>
          <Button onClick={salvarNoStorage} disabled={!form || salvando}>
            <Save className="h-4 w-4 mr-1" />{salvando ? "Salvando…" : "Salvar aditivo"}
          </Button>
        </div>
      </div>

      {!form ? (
        <p className="text-sm text-muted-foreground">Carregando dados do contrato…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-6">
            <section>
              <h2 className="font-semibold mb-2">LOCADORA (Proprietário)</h2>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nome"><Input value={form.loc_nome} onChange={(e) => set("loc_nome", e.target.value)} /></Field>
                <Field label="Nacionalidade"><Input value={form.loc_nacionalidade} onChange={(e) => set("loc_nacionalidade", e.target.value)} /></Field>
                <Field label="Estado civil"><Input value={form.loc_estado_civil} onChange={(e) => set("loc_estado_civil", e.target.value)} /></Field>
                <Field label="Profissão"><Input value={form.loc_profissao} onChange={(e) => set("loc_profissao", e.target.value)} /></Field>
                <Field label="RG"><Input value={form.loc_rg} onChange={(e) => set("loc_rg", e.target.value)} /></Field>
                <Field label="CPF"><Input value={form.loc_cpf} onChange={(e) => set("loc_cpf", e.target.value)} /></Field>
                <Field label="Endereço" full><Input value={form.loc_endereco} onChange={(e) => set("loc_endereco", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-2">LOCATÁRIO (Inquilino)</h2>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nome"><Input value={form.inq_nome} onChange={(e) => set("inq_nome", e.target.value)} /></Field>
                <Field label="Nacionalidade"><Input value={form.inq_nacionalidade} onChange={(e) => set("inq_nacionalidade", e.target.value)} /></Field>
                <Field label="Estado civil"><Input value={form.inq_estado_civil} onChange={(e) => set("inq_estado_civil", e.target.value)} /></Field>
                <Field label="Profissão"><Input value={form.inq_profissao} onChange={(e) => set("inq_profissao", e.target.value)} /></Field>
                <Field label="RG"><Input value={form.inq_rg} onChange={(e) => set("inq_rg", e.target.value)} /></Field>
                <Field label="CPF"><Input value={form.inq_cpf} onChange={(e) => set("inq_cpf", e.target.value)} /></Field>
                <Field label="Endereço" full><Input value={form.inq_endereco} onChange={(e) => set("inq_endereco", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-2">Imóvel</h2>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Descrição" full><Input value={form.imv_descricao} onChange={(e) => set("imv_descricao", e.target.value)} /></Field>
                <Field label="Edifício"><Input value={form.imv_edificio} onChange={(e) => set("imv_edificio", e.target.value)} /></Field>
                <Field label="CEP"><Input value={form.imv_cep} onChange={(e) => set("imv_cep", e.target.value)} /></Field>
                <Field label="Endereço completo" full><Input value={form.imv_endereco} onChange={(e) => set("imv_endereco", e.target.value)} /></Field>
                <Field label="Cômodos" full><Input value={form.imv_comodos} onChange={(e) => set("imv_comodos", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-2">Termos da renovação</h2>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data do contrato original"><Input type="date" value={form.data_contrato_original} onChange={(e) => set("data_contrato_original", e.target.value)} /></Field>
                <Field label="Data de assinatura"><Input type="date" value={form.data_assinatura} onChange={(e) => set("data_assinatura", e.target.value)} /></Field>
                <Field label="Prazo (meses)"><Input type="number" value={form.prazo_meses} onChange={(e) => set("prazo_meses", Number(e.target.value))} /></Field>
                <Field label="Aviso prévio (dias)"><Input type="number" value={form.aviso_previo_dias} onChange={(e) => set("aviso_previo_dias", Number(e.target.value))} /></Field>
                <Field label="Multa rescisória (x alugueres)"><Input type="number" value={form.multa_rescisoria_multiplicador} onChange={(e) => set("multa_rescisoria_multiplicador", Number(e.target.value))} /></Field>
                <Field label="Dia de vencimento"><Input type="number" value={form.dia_vencimento} onChange={(e) => set("dia_vencimento", Number(e.target.value))} /></Field>
                <Field label="Valor do aluguel (R$)">
                  <Input
                    value={formatBRL(form.valor_aluguel)}
                    onChange={(e) => set("valor_aluguel", parseBRL(e.target.value) ?? 0)}
                  />
                </Field>
                <Field label="Aluguel por extenso"><Input value={form.valor_aluguel_extenso} onChange={(e) => set("valor_aluguel_extenso", e.target.value)} /></Field>
                <Field label="Índice de reajuste"><Input value={form.indice_reajuste} onChange={(e) => set("indice_reajuste", e.target.value)} /></Field>
                <Field label="Multa de mora (%)"><Input type="number" step="0.01" value={form.multa_mora_percent} onChange={(e) => set("multa_mora_percent", Number(e.target.value))} /></Field>
                <Field label="Juros mora (% a.m.)"><Input type="number" step="0.01" value={form.juros_mora_mensal_percent} onChange={(e) => set("juros_mora_mensal_percent", Number(e.target.value))} /></Field>
                <Field label="Caução (R$)">
                  <Input
                    value={formatBRL(form.caucao_valor)}
                    onChange={(e) => set("caucao_valor", parseBRL(e.target.value) ?? 0)}
                  />
                </Field>
                <Field label="Texto da garantia" full><Input value={form.caucao_texto} onChange={(e) => set("caucao_texto", e.target.value)} /></Field>
                <Field label="Foro" full><Input value={form.foro} onChange={(e) => set("foro", e.target.value)} /></Field>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">Cláusulas (edite livremente)</h2>
              {([
                ["cl_consideracoes", "Considerações iniciais"],
                ["cl_objeto", "Cláusula 1ª – Objeto"],
                ["cl_prazo", "Cláusula 2ª – Prazo"],
                ["cl_preco", "Cláusula 3ª – Preço"],
                ["cl_reajuste", "Cláusula 4ª – Reajuste"],
                ["cl_encargos", "Cláusula 5ª – Encargos"],
                ["cl_mora", "Cláusula 6ª – Mora"],
                ["cl_utilizacao", "Cláusula 7ª – Utilização e benfeitorias"],
                ["cl_garantia", "Cláusula 8ª – Garantia locatícia"],
                ["cl_disposicoes", "Cláusula 9ª – Disposições gerais"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Textarea
                    rows={5}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </div>
              ))}
            </section>
          </Card>

          <Card className="p-4 space-y-3 lg:sticky lg:top-4 h-fit">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <h2 className="font-semibold">Pré-visualização</h2>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 font-serif bg-muted/30 rounded p-3 max-h-[70vh] overflow-auto">
              {documento}
            </pre>
            {ultimoPath && (
              <div className="border rounded p-3 space-y-2">
                <p className="text-sm">Aditivo salvo com sucesso.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={abrirSalvo}>
                    Abrir PDF salvo
                  </Button>
                  <Button size="sm" onClick={lancarHonorario}>
                    <Wallet className="h-4 w-4 mr-1" />Lançar honorário de renovação
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}