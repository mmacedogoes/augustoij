import { z } from "zod";

/**
 * descreverResultado(item, resultado)
 * Devolve a frase do resultado em português padrão jurídico.
 */
export function descreverResultado(item: any, resultado: any): string {
  const { aprovado, quorum_atingido, quorum_exigido, empate } = resultado;
  
  const baseCalculo = item.regra_quorum.includes("presenca") 
    ? "presentes" 
    : "fração ideal";
    
  const regraTexto = item.regra_quorum
    .replace("unanimidade", "unanimidade")
    .replace("dois_tercos", "dois terços")
    .replace("maioria_absoluta", "maioria absoluta")
    .replace("maioria_simples", "maioria simples");

  const percObtido = (quorum_atingido * 100).toFixed(1);
  const percExigido = (quorum_exigido * 100).toFixed(1);

  if (empate) {
    return `Item em empate técnico. Quórum de ${regraTexto} exigido sobre ${baseCalculo}.`;
  }

  if (aprovado) {
    return `Aprovado. Quórum de ${regraTexto} atingido por ${baseCalculo}, com ${percObtido}% contra os ${percExigido}% exigidos.`;
  } else {
    if (quorum_atingido >= quorum_exigido) {
      return `Rejeitado. Quórum de ${regraTexto} atingido por ${baseCalculo}, mas a maioria dos votos foi contrária.`;
    } else {
      return `Quórum não atingido. Obtido ${percObtido}% de ${baseCalculo}, insuficiente para os ${percExigido}% exigidos por ${regraTexto}.`;
    }
  }
}
