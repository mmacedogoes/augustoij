$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 6] Validação do Componente KPI Metric Card com Delta ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$kpiPath = Join-Path $root "src\components\ui\kpi-metric-card.tsx"
$painelPath = Join-Path $root "src\routes\_authenticated\app.contratos.painel.tsx"

$passed = 0
$failed = 0

function Assert-Condition($name, $condition) {
    if ($condition) {
        Write-Host "  [OK] $name" -ForegroundColor Green
        $global:passed++
    } else {
        Write-Host "  [FALHA] $name" -ForegroundColor Red
        $global:failed++
    }
}

# 1. Verificar existência do componente KpiMetricCard
Assert-Condition "Arquivo src/components/ui/kpi-metric-card.tsx existe" (Test-Path $kpiPath)

if (Test-Path $kpiPath) {
    $kpiContent = Get-Content $kpiPath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente KpiMetricCard" ($kpiContent -match "export const KpiMetricCard\b")
    Assert-Condition "Suporta indicador de delta com tendências up/down/neutral" ($kpiContent -match "delta\.trend" -and $kpiContent -match "ArrowUpRight" -and $kpiContent -match "ArrowDownRight")
    Assert-Condition "Suporta tons semânticos (gold, emerald, amber, rose, neutral, default)" ($kpiContent -match "toneStyles")
    Assert-Condition "Suporta modo interativo para clique e hover" ($kpiContent -match "interactive")
}

# 2. Verificar integração no Painel de Contratos
Assert-Condition "Arquivo app.contratos.painel.tsx existe" (Test-Path $painelPath)

if (Test-Path $painelPath) {
    $painelContent = Get-Content $painelPath -Raw -Encoding UTF8
    Assert-Condition "Importa KpiMetricCard de @/components/ui/kpi-metric-card" ($painelContent -match "from\s+[`"']@/components/ui/kpi-metric-card[`"']")
    Assert-Condition "Renderiza <KpiMetricCard> para Contratos Vigentes" ($painelContent -match "label=[`"']Contratos Vigentes[`"']")
    Assert-Condition "Renderiza <KpiMetricCard> para Exige Atenção com delta" ($painelContent -match "label=[`"']Exige Aten..o[`"']")
    Assert-Condition "Renderiza <KpiMetricCard> para Vencidos / Críticos com ação" ($painelContent -match "label=[`"']Vencidos / Cr.ticos[`"']")
    Assert-Condition "Renderiza <KpiMetricCard> para Valor Anual Estimado" ($painelContent -match "label=[`"']Valor Anual Estimado[`"']")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
