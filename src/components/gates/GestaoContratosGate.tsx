import type { ReactNode } from "react";

/**
 * Módulo de Gestão de Contratos liberado para todos os planos.
 * Os limites comerciais continuam valendo na criação de contratos
 * (ver `assertNovoContratoPermitido`), com mensagem de upgrade no ato.
 */
export function GestaoContratosGate({
  children,
}: {
  requerePainelConsolidado?: boolean;
  children: ReactNode;
}) {
  return <>{children}</>;
}
