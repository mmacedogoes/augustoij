import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  FileText,
  Sparkles,
  Upload,
  Download,
  Pencil,
  ShieldCheck,
  Trash2,
  Loader2,
  AudioLines,
} from "lucide-react";
import {
  getAta,
  gerarAtaIA,
  preencherLacuna,
  dispensarLacuna,
  editarBloco,
  publicarAta,
  criarNovaVersaoAta,
  consumoIaAssembleia,
} from "@/lib/assembleias/ata.functions";
import {
  listarGravacoes,
  urlGravacao,
  urlUploadGravacao,
  registrarBloco,
  iniciarGravacao,
  consolidarGravacao,
  excluirGravacoes,
} from "@/lib/assembleias/gravacao.functions";
import {
  transcreverBloco,
  enviarTranscricaoManual,
  sugerirFalantes,
  salvarFalante,
} from "@/lib/assembleias/transcricao.functions";
import { gerarPdfAta } from "@/lib/assembleias/ata-pdf";
import { duracaoDoArquivo } from "@/lib/assembleias/gravador";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/ata")({
  component: AtaPage,
  head: () => ({
    meta: [
      { title: "Ata da assembleia · Augusto.IJ" },
      {
        name: "description",
        content:
          "Redação assistida da ata: transcrição, procedência por trecho de áudio, lacunas e publicação com hash.",
      },
    ],
  }),
});

function formatarInstante(seg: number | null | undefined): string {
  if (seg === null || seg === undefined) return "--:--";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function AtaPage() {
  const { assembleiaId } = useParams({
    from: "/_authenticated/app/assembleias/$assembleiaId/ata",
  }) as any;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchAta = useServerFn(getAta);
  const fetchGravacoes = useServerFn(listarGravacoes);
  const fetchConsumo = useServerFn(consumoIaAssembleia);
  const fetchSugestoes = useServerFn(sugerirFalantes);
  const gerar = useServerFn(gerarAtaIA);
  const preencher = useServerFn(preencherLacuna);
  const dispensar = useServerFn(dispensarLacuna);
  const editar = useServerFn(editarBloco);
  const publicar = useServerFn(publicarAta);
  const novaVersao = useServerFn(criarNovaVersaoAta);
  const transcrever = useServerFn(transcreverBloco);
  const transcricaoManual = useServerFn(enviarTranscricaoManual);
  const salvarNomeFalante = useServerFn(salvarFalante);
  const consolidar = useServerFn(consolidarGravacao);
  const excluirAudio = useServerFn(excluirGravacoes);
  const criarUrlUpload = useServerFn(urlUploadGravacao);
  const registrar = useServerFn(registrarBloco);
  const iniciarSessaoFn = useServerFn(iniciarGravacao);
  const tocarUrl = useServerFn(urlGravacao);

  const [versaoId, setVersaoId] = useState<string | undefined>(undefined);
  const [blocoSelecionado, setBlocoSelecionado] = useState<string | null>(null);
  const [lacunaAtiva, setLacunaAtiva] = useState<string | null>(null);
  const [valorLacuna, setValorLacuna] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvarCadastro, setSalvarCadastro] = useState(false);
  const [editandoBloco, setEditandoBloco] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [dialogTranscricao, setDialogTranscricao] = useState(false);
  const [textoTranscricao, setTextoTranscricao] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: ata, isLoading } = useQuery({
    queryKey: ["ata", assembleiaId, versaoId],
    queryFn: () => fetchAta({ data: { assembleiaId, versaoId } }),
  });
  const { data: gravacoes } = useQuery({
    queryKey: ["ata-gravacoes", assembleiaId],
    queryFn: () => fetchGravacoes({ data: { assembleiaId } }),
    refetchInterval: 10000,
  });
  const { data: consumo } = useQuery({
    queryKey: ["ata-consumo", assembleiaId],
    queryFn: () => fetchConsumo({ data: { assembleiaId } }),
  });
  const { data: falantes } = useQuery({
    queryKey: ["ata-falantes", assembleiaId],
    queryFn: () => fetchSugestoes({ data: { assembleiaId } }),
  });

  const lacunasAbertas = (ata?.lacunas ?? []).filter((l: any) => l.situacao === "aberta");
  const bloco = (ata?.blocos ?? []).find((b: any) => b.id === blocoSelecionado);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["ata", assembleiaId] });
  };

  const mGerar = useMutation({
    mutationFn: () => gerar({ data: { assembleiaId } }),
    onSuccess: () => {
      toast.success("Rascunho da ata gerado.");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mPublicar = useMutation({
    mutationFn: () => publicar({ data: { versaoId: ata!.versao!.id } }),
    onSuccess: () => {
      toast.success("Ata publicada.");
      invalidar();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mTranscrever = useMutation({
    mutationFn: (gravacaoId: string) => transcrever({ data: { gravacaoId } }),
    onSuccess: () => {
      toast.success("Bloco transcrito.");
      queryClient.invalidateQueries({ queryKey: ["ata-gravacoes", assembleiaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const processarFila = async () => {
    const blocos = (gravacoes?.blocos ?? []).filter((b: any) => b.status !== "transcrito");
    for (const b of blocos) {
      try {
        await transcrever({ data: { gravacaoId: b.id } });
      } catch {
        /* falha em um bloco não interrompe os demais */
      }
      queryClient.invalidateQueries({ queryKey: ["ata-gravacoes", assembleiaId] });
    }
    await consolidar({ data: { assembleiaId } }).catch(() => null);
  };

  const enviarArquivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const ordenados = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    const grandes = await Promise.all(ordenados.map((f) => duracaoDoArquivo(f)));
    if (ordenados.length === 1 && grandes[0] > 20 * 60) {
      toast.error(
        "Arquivo com mais de 20 minutos. Divida em partes e envie vários arquivos: a ordem será definida pelo nome.",
      );
      return;
    }

    const { sessaoId } = await iniciarSessaoFn({
      data: { assembleiaId, comunicouPresentes: true, modoGravador: "unico", formato: "upload" },
    });

    let offset = 0;
    for (let i = 0; i < ordenados.length; i++) {
      const file = ordenados[i];
      const dur = grandes[i] || 0;
      const { url, path } = await criarUrlUpload({
        data: { assembleiaId, tipo: "bloco", nomeArquivo: file.name },
      });
      const token = new URL(url, window.location.origin).searchParams.get("token") ?? "";
      const { error } = await supabase.storage
        .from("assembleia-gravacoes")
        .uploadToSignedUrl(path, token, file);
      if (error) {
        toast.error(`Falha ao enviar ${file.name}: ${error.message}`);
        continue;
      }
      await registrar({
        data: {
          assembleiaId,
          sessaoId,
          arquivoPath: path,
          blocoOrdem: i + 1,
          offsetInicioSeg: offset,
          duracaoSeg: dur,
        },
      });
      offset += dur;
    }
    toast.success(`${ordenados.length} parte(s) enviada(s) na ordem do nome do arquivo.`);
    queryClient.invalidateQueries({ queryKey: ["ata-gravacoes", assembleiaId] });
  };

  const tocarTrecho = async (instante: number | null) => {
    if (instante === null || instante === undefined) return;
    const blocos = gravacoes?.blocos ?? [];
    const alvo =
      blocos.find(
        (b: any) => instante >= b.offset_inicio_seg && instante < b.offset_inicio_seg + (b.duracao_seg ?? 0),
      ) ??
      gravacoes?.mestre ??
      blocos[0];
    if (!alvo) return toast.error("Nenhuma gravação disponível.");
    try {
      const { url } = await tocarUrl({ data: { gravacaoId: alvo.id } });
      const dentro = alvo.bloco_ordem === 0 ? instante : instante - alvo.offset_inicio_seg;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.currentTime = Math.max(0, dentro);
      await audioRef.current.play();
      audioRef.current.currentTime = Math.max(0, dentro);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível tocar o trecho.");
    }
  };

  const baixarPdf = async () => {
    if (!ata?.versao) return;
    const paragrafos = (ata.blocos ?? []).map((b: any) => textoResolvido(b.texto, ata.lacunas));
    const blob = await gerarPdfAta({
      titulo: `Ata da ${ata.assembleia?.tipo === "extraordinaria" ? "Assembleia Geral Extraordinária" : "Assembleia Geral Ordinária"} — ${ata.assembleia?.condominio?.nome ?? ""}`,
      paragrafos,
      presidente: ata.assembleia?.presidente_nome ?? null,
      secretario: ata.assembleia?.secretario_nome ?? null,
      rascunho: ata.versao.situacao !== "publicada",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ata-${ata.versao.numero}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const textoResolvido = (texto: string, lacunas: any[]) => {
    let out = texto;
    for (const l of lacunas ?? []) {
      const sub =
        l.situacao === "preenchida" && l.valor_preenchido
          ? l.valor_preenchido
          : l.situacao === "dispensada"
            ? ""
            : `[${l.ancora_texto}]`;
      out = out.replaceAll(`[[LACUNA:${l.id}]]`, sub);
    }
    return out;
  };

  const renderTexto = (b: any) => {
    const partes = String(b.texto).split(/(\[\[LACUNA:[0-9a-f-]+\]\])/gi);
    return partes.map((parte, i) => {
      const match = parte.match(/^\[\[LACUNA:([0-9a-f-]+)\]\]$/i);
      if (!match) return <span key={i}>{parte}</span>;
      const lac = (ata?.lacunas ?? []).find((l: any) => l.id === match[1]);
      if (!lac) return null;
      if (lac.situacao === "preenchida") return <span key={i}>{lac.valor_preenchido}</span>;
      if (lac.situacao === "dispensada") return null;
      return (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLacunaAtiva(lac.id);
            setValorLacuna("");
            setJustificativa("");
          }}
          className="bg-augusto-gold/15 text-augusto-gold underline decoration-dotted decoration-augusto-gold underline-offset-4 rounded px-1 focus-visible:outline-2 focus-visible:outline-augusto-gold"
        >
          [{lac.ancora_texto}]
        </button>
      );
    });
  };

  const totalBlocos = gravacoes?.totalBlocos ?? 0;
  const transcritos = gravacoes?.blocosTranscritos ?? 0;

  const nomesSugeridos = useMemo(() => falantes?.sugestoes ?? {}, [falantes]);

  if (isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-[70vh] w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto space-y-6 animate-augusto-fade-up">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-augusto-gold/10 pb-5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}` as any })}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-serif text-primary">
                Ata da {ata?.assembleia?.tipo === "extraordinaria" ? "AGE" : "AGO"} de{" "}
                {ata?.assembleia?.data_hora
                  ? new Date(ata.assembleia.data_hora).toLocaleDateString("pt-BR")
                  : "—"}
                {ata?.versao ? ` · ${ata.versao.situacao} ${ata.versao.numero}` : ""}
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {ata?.assembleia?.condominio?.nome}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {ata?.versoes && ata.versoes.length > 1 && (
              <select
                aria-label="Versão da ata"
                className="h-9 rounded-md border border-augusto-gold/20 bg-background px-2 text-sm"
                value={ata.versao?.id}
                onChange={(e) => setVersaoId(e.target.value)}
              >
                {ata.versoes.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    v{v.numero} · {v.situacao}
                    {v.hash_publicacao ? ` · ${String(v.hash_publicacao).slice(0, 8)}` : ""}
                  </option>
                ))}
              </select>
            )}
            <Badge className="bg-augusto-gold/15 text-augusto-gold border-augusto-gold/30">
              {lacunasAbertas.length} lacuna(s) pendente(s)
            </Badge>
          </div>
        </header>

        {/* Captura e transcrição */}
        <Card className="border-augusto-gold/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-serif flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-augusto-gold" /> Gravação e transcrição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {totalBlocos} bloco(s) enviado(s) · {transcritos} transcrito(s)
              {gravacoes && !gravacoes.possuiArquivoContinuo && totalBlocos > 0
                ? " · o arquivo contínuo não foi produzido; os blocos permanecem como acervo."
                : ""}
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex">
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.webm,.ogg"
                  onChange={(e) => void enviarArquivos(e.target.files)}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-augusto-gold/20 px-3 text-sm cursor-pointer">
                  <Upload className="h-4 w-4 text-augusto-gold" /> Enviar gravação
                </span>
              </label>
              <Button variant="outline" className="gap-2" onClick={() => void processarFila()}>
                <Sparkles className="h-4 w-4 text-augusto-gold" /> Transcrever blocos pendentes
              </Button>
              <Button variant="ghost" className="gap-2" onClick={() => setDialogTranscricao(true)}>
                <FileText className="h-4 w-4" /> Enviar transcrição pronta
              </Button>
              <Button
                variant="augusto"
                className="gap-2"
                disabled={mGerar.isPending}
                onClick={() => mGerar.mutate()}
              >
                {mGerar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar ata
              </Button>
            </div>
            {(gravacoes?.blocos ?? []).length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {gravacoes!.blocos.map((b: any) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-md border border-augusto-gold/10 px-3 py-2 text-xs"
                  >
                    <span>
                      Bloco {b.bloco_ordem} · {formatarInstante(b.offset_inicio_seg)} · {b.status}
                    </span>
                    {b.status === "falhou" && (
                      <Button size="sm" variant="ghost" onClick={() => mTranscrever.mutate(b.id)}>
                        Reprocessar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {!ata?.versao ? (
          <Card className="p-12 text-center border-dashed border-2 border-augusto-gold/20">
            <FileText className="h-10 w-10 mx-auto text-augusto-gold/40 mb-4" />
            <p className="text-sm text-muted-foreground">
              Nenhum rascunho de ata ainda. Gere a ata depois de transcrever a gravação.
            </p>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[1fr,380px] gap-8">
            <main>
              <article className="rounded-xl border border-augusto-gold/15 bg-[hsl(var(--muted))]/20 p-8 max-h-[70vh] overflow-y-auto">
                <h2 className="text-center font-serif uppercase tracking-wide text-lg mb-8">
                  Ata da assembleia — {ata.assembleia?.condominio?.nome}
                </h2>
                <div className="space-y-5">
                  {(ata.blocos ?? []).map((b: any) => (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setBlocoSelecionado(b.id);
                        void tocarTrecho(b.origem_audio_inicio);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setBlocoSelecionado(b.id);
                      }}
                      className={`text-justify leading-relaxed font-serif text-[16.5px] cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-augusto-gold ${
                        blocoSelecionado === b.id ? "bg-augusto-gold/5" : ""
                      }`}
                    >
                      {b.item?.ordem ? (
                        <span className="text-augusto-gold font-bold mr-2">{romano(b.item.ordem)}.</span>
                      ) : null}
                      {renderTexto(b)}
                    </div>
                  ))}
                </div>
              </article>
            </main>

            <aside className="space-y-6">
              <Card className="border-augusto-gold/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif">Lacunas a preencher</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Clique na marcação dourada dentro do texto. A ata só pode ser publicada com todas resolvidas.
                  </p>
                  {lacunasAbertas.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhuma lacuna aberta.</p>
                  )}
                  {lacunasAbertas.map((l: any) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLacunaAtiva(l.id)}
                      className="block w-full text-left rounded-md border border-augusto-gold/10 p-3"
                    >
                      <span className="block text-xs font-bold">{l.ancora_texto}</span>
                      <span className="block text-[11px] text-muted-foreground">{l.descricao}</span>
                      {l.referencia_audio_seg !== null && (
                        <span className="text-[10px] font-mono text-augusto-gold">
                          {formatarInstante(l.referencia_audio_seg)}
                        </span>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-augusto-gold/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif">Como este trecho foi escrito</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {bloco ? (
                    <>
                      <p className="font-mono text-augusto-gold">
                        Áudio {formatarInstante(bloco.origem_audio_inicio)} –{" "}
                        {formatarInstante(bloco.origem_audio_fim)}
                      </p>
                      {bloco.tipo === "item" && (
                        <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-600/20">
                          Apuração registrada
                        </Badge>
                      )}
                      {bloco.item?.fundamento_legal && (
                        <Badge className="bg-augusto-gold/15 text-augusto-gold border-augusto-gold/30">
                          {bloco.item.fundamento_legal}
                        </Badge>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Cada parágrafo guarda o trecho de áudio de origem.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">Selecione um parágrafo.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-augusto-gold/10">
                <CardContent className="p-4 grid gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setLacunaAtiva(lacunasAbertas[0]?.id ?? null)}
                    disabled={lacunasAbertas.length === 0}
                  >
                    <ShieldCheck className="h-4 w-4 text-augusto-gold" /> Preencher lacunas
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      const alvo = bloco ?? (ata.blocos ?? [])[0];
                      if (!alvo) return;
                      setEditandoBloco(alvo.id);
                      setTextoEdicao(alvo.texto);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar texto livremente
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => void baixarPdf()}>
                    <Download className="h-4 w-4" /> Baixar PDF do rascunho
                  </Button>
                  {ata.versao.situacao === "rascunho" ? (
                    <Button
                      variant="augusto"
                      onClick={() => mPublicar.mutate()}
                      disabled={lacunasAbertas.length > 0 || mPublicar.isPending}
                    >
                      Publicar ata
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          novaVersao({ data: { assembleiaId } })
                            .then(() => {
                              toast.success("Nova versão criada.");
                              invalidar();
                            })
                            .catch((e: any) => toast.error(e.message))
                        }
                      >
                        Criar nova versão
                      </Button>
                      <Button
                        variant="ghost"
                        className="gap-2 text-destructive"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "A gravação pode ser útil enquanto correr o prazo para anulação de deliberação. A exclusão é definitiva. Excluir mesmo assim?",
                            )
                          )
                            return;
                          excluirAudio({ data: { assembleiaId } })
                            .then(() => toast.success("Gravação excluída do armazenamento."))
                            .catch((e: any) => toast.error(e.message));
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> Excluir gravação do armazenamento
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-augusto-gold/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif">Quem falou</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(falantes?.rotulos ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum falante identificado ainda.</p>
                  )}
                  {(falantes?.rotulos ?? []).map((rotulo: string) => {
                    const sug = (nomesSugeridos as any)[rotulo];
                    return (
                      <div key={rotulo} className="space-y-1">
                        <Label className="text-[11px]">{rotulo}</Label>
                        <Input
                          defaultValue={sug?.nome ?? ""}
                          placeholder={
                            sug ? `Sugestão: ${sug.nome} (${sug.sobreposicao}% de sobreposição)` : "Nome do falante"
                          }
                          onBlur={(e) => {
                            const nome = e.target.value.trim();
                            if (nome.length < 2) return;
                            salvarNomeFalante({
                              data: {
                                assembleiaId,
                                rotuloIa: rotulo,
                                nome,
                                unidadeId: sug?.unidadeId ?? null,
                                papel: "participante",
                              },
                            })
                              .then(() => toast.success(`${rotulo} identificado como ${nome}.`))
                              .catch((err: any) => toast.error(err.message));
                          }}
                        />
                      </div>
                    );
                  })}
                  {(falantes?.nomesInstalacao ?? []).length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Mesa: {(falantes?.nomesInstalacao ?? []).join(" · ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        )}

        <Card className="border-augusto-gold/10 bg-muted/10">
          <CardContent className="p-4 text-[11px] text-muted-foreground flex flex-wrap gap-6">
            <span className="font-bold uppercase tracking-widest">Consumo de IA desta assembleia</span>
            <span>{consumo?.minutosAudio ?? 0} min de áudio processados</span>
            <span>{consumo?.tokensInput ?? 0} tokens de entrada</span>
            <span>{consumo?.tokensOutput ?? 0} tokens de saída</span>
            <span>{consumo?.chamadas ?? 0} chamadas</span>
          </CardContent>
        </Card>
      </div>

      {/* Preenchimento de lacuna */}
      <Dialog open={!!lacunaAtiva} onOpenChange={(v) => !v && setLacunaAtiva(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Preencher lacuna</DialogTitle>
            <DialogDescription>
              {(ata?.lacunas ?? []).find((l: any) => l.id === lacunaAtiva)?.descricao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Input id="valor" value={valorLacuna} onChange={(e) => setValorLacuna(e.target.value)} />
            </div>
            {(ata?.lacunas ?? []).find((l: any) => l.id === lacunaAtiva)?.tipo === "dado_cadastral" && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={salvarCadastro}
                  onChange={(e) => setSalvarCadastro(e.target.checked)}
                />
                Salvar também no cadastro do condomínio
              </label>
            )}
            <div className="space-y-2">
              <Label htmlFor="justificativa">Ou dispense com justificativa (mín. 10 caracteres)</Label>
              <Textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() =>
                dispensar({ data: { lacunaId: lacunaAtiva!, justificativa } })
                  .then(() => {
                    toast.success("Lacuna dispensada.");
                    setLacunaAtiva(null);
                    invalidar();
                  })
                  .catch((e: any) => toast.error(e.message))
              }
            >
              Dispensar
            </Button>
            <Button
              variant="augusto"
              disabled={!valorLacuna.trim()}
              onClick={() =>
                preencher({
                  data: {
                    lacunaId: lacunaAtiva!,
                    valor: valorLacuna,
                    salvarNoCadastro: salvarCadastro,
                    campoCadastro: "endereco",
                  },
                })
                  .then(() => {
                    toast.success("Lacuna preenchida.");
                    setLacunaAtiva(null);
                    invalidar();
                  })
                  .catch((e: any) => toast.error(e.message))
              }
            >
              Preencher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edição de bloco */}
      <Dialog open={!!editandoBloco} onOpenChange={(v) => !v && setEditandoBloco(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Editar parágrafo</DialogTitle>
            <DialogDescription>
              Um parágrafo editado à mão deixa de ter a confiança da IA e fica assim registrado para a auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={10} value={textoEdicao} onChange={(e) => setTextoEdicao(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoBloco(null)}>
              Cancelar
            </Button>
            <Button
              variant="augusto"
              onClick={() =>
                editar({ data: { blocoId: editandoBloco!, texto: textoEdicao } })
                  .then(() => {
                    toast.success("Parágrafo atualizado.");
                    setEditandoBloco(null);
                    invalidar();
                  })
                  .catch((e: any) => toast.error(e.message))
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transcrição manual */}
      <Dialog open={dialogTranscricao} onOpenChange={setDialogTranscricao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Enviar transcrição pronta</DialogTitle>
            <DialogDescription>
              Use este caminho quando a transcrição automática não acontecer. Nada será simulado: a ata usará
              exatamente o texto enviado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={12}
            placeholder="Cole aqui a transcrição, uma fala por linha (ex.: Falante 1: ...)"
            value={textoTranscricao}
            onChange={(e) => setTextoTranscricao(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTranscricao(false)}>
              Cancelar
            </Button>
            <Button
              variant="augusto"
              onClick={() =>
                transcricaoManual({ data: { assembleiaId, texto: textoTranscricao } })
                  .then(() => {
                    toast.success("Transcrição registrada.");
                    setDialogTranscricao(false);
                    queryClient.invalidateQueries({ queryKey: ["ata-gravacoes", assembleiaId] });
                  })
                  .catch((e: any) => toast.error(e.message))
              }
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function romano(n: number): string {
  const mapa: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let resto = n;
  let out = "";
  for (const [valor, letra] of mapa) {
    while (resto >= valor) {
      out += letra;
      resto -= valor;
    }
  }
  return out;
}
