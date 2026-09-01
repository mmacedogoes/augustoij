#!/usr/bin/env bash
# Roda a suíte E2E localmente. Uso:
#   ./scripts/run-e2e.sh                 # todos os projetos
#   ./scripts/run-e2e.sh --ui            # modo interativo
#   ./scripts/run-e2e.sh e2e/specs/01-auth.spec.ts
set -euo pipefail
cd "$(dirname "$0")/.."

export PLAYWRIGHT_PORT="${PLAYWRIGHT_PORT:-8080}"
export PLAYWRIGHT_TEST_BASE_URL="${PLAYWRIGHT_TEST_BASE_URL:-http://localhost:${PLAYWRIGHT_PORT}}"

if [ ! -d "node_modules/@playwright/test" ]; then
  echo "→ Instalando dependências…"
  bun install
fi

echo "→ Garantindo navegadores do Playwright…"
bunx playwright install >/dev/null

echo "→ Executando testes (${PLAYWRIGHT_TEST_BASE_URL})"
bunx playwright test "$@"
