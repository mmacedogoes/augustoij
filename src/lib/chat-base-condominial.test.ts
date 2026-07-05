import { describe, it, expect } from "vitest";
import {
  avaliarBaseCondominial,
  deveSolicitarReupload,
  blocoContextoCondominial,
  AVISO_INTERNO_SEM_BASE,
  FALLBACK_SEM_MATCH,
} from "./chat-base-condominial";

describe("avaliarBaseCondominial", () => {
  it("detecta convenção pronta", () => {
    const r = avaliarBaseCondominial([{ tipo: "convencao" }]);
    expect(r.temConvencao).toBe(true);
    expect(r.temBaseCondominial).toBe(true);
  });

  it("detecta regimento pronto", () => {
    const r = avaliarBaseCondominial([{ tipo: "regimento" }]);
    expect(r.temRegimento).toBe(true);
    expect(r.temBaseCondominial).toBe(true);
  });

  it("sem docs → sem base", () => {
    expect(avaliarBaseCondominial([]).temBaseCondominial).toBe(false);
    expect(avaliarBaseCondominial(null).temBaseCondominial).toBe(false);
  });
});

describe("deveSolicitarReupload", () => {
  const base = {
    temBaseCondominial: false,
    temMatchDocumento: false,
    temAnexoTemporario: false,
    perguntaNorm: "posso ter pet no condominio",
  };

  it("convenção pronta bloqueia reupload mesmo sem match RAG", () => {
    expect(deveSolicitarReupload({ ...base, temBaseCondominial: true })).toBe(false);
  });

  it("anexo temporário bloqueia reupload mesmo sem base", () => {
    expect(deveSolicitarReupload({ ...base, temAnexoTemporario: true })).toBe(false);
  });

  it("match RAG bloqueia reupload mesmo sem base", () => {
    expect(deveSolicitarReupload({ ...base, temMatchDocumento: true })).toBe(false);
  });

  it("sem base, sem match, sem anexo → pede reupload", () => {
    expect(deveSolicitarReupload(base)).toBe(true);
  });

  it("pergunta vazia não dispara reupload", () => {
    expect(deveSolicitarReupload({ ...base, perguntaNorm: "" })).toBe(false);
  });
});

describe("blocoContextoCondominial", () => {
  it("com contexto real, usa o contexto e ignora aviso interno", () => {
    const bloco = blocoContextoCondominial({
      contexto: "trecho X da convenção",
      temBaseCondominial: true,
    });
    expect(bloco).toContain("trecho X da convenção");
    expect(bloco).not.toContain("AVISO INTERNO");
  });

  it("base pronta sem match → fallback neutro, sem AVISO INTERNO", () => {
    const bloco = blocoContextoCondominial({
      contexto: "",
      temBaseCondominial: true,
    });
    expect(bloco).toBe(FALLBACK_SEM_MATCH);
    expect(bloco).not.toContain("AVISO INTERNO");
  });

  it("sem base → injeta AVISO INTERNO (regressão)", () => {
    const bloco = blocoContextoCondominial({
      contexto: "",
      temBaseCondominial: false,
    });
    expect(bloco).toBe(AVISO_INTERNO_SEM_BASE);
    expect(bloco).toContain("AVISO INTERNO");
  });
});