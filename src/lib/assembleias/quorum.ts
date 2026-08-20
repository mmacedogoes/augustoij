
import { z } from "zod";

/**
 * Funções puras para cálculo de quórum, permitindo testes unitários
 * e consistência entre banco, servidor e interface.
 */

export interface QuorumConfig {
  tipo: 'maioria_simples' | 'maioria_absoluta' | 'dois_terços' | 'unanimidade';
  base_calculo: 'unidades' | 'fracao_ideal';
}

export interface ResultadoCalculado {
  aprovado: boolean;
  quorum_atingido: number;
  quorum_exigido: number;
  total_votos: number;
  total_base: number;
}

export function calcularQuorum(
  votosFavoraveis: number,
  totalBase: number,
  config: QuorumConfig
): ResultadoCalculado {
  let exigido = 0;
  
  switch (config.tipo) {
    case 'maioria_simples':
      // Mais que a metade dos presentes (aqui totalBase deve ser o total de presentes/aptos)
      exigido = (totalBase / 2) + 0.000001;
      break;
    case 'maioria_absoluta':
      // Mais que a metade de todas as unidades/frações do condomínio
      exigido = (totalBase / 2) + 0.000001;
      break;
    case 'dois_terços':
      exigido = (totalBase * 2) / 3;
      break;
    case 'unanimidade':
      exigido = totalBase;
      break;
  }

  return {
    aprovado: votosFavoraveis >= exigido,
    quorum_atingido: votosFavoraveis,
    quorum_exigido: exigido,
    total_votos: votosFavoraveis,
    total_base: totalBase
  };
}
