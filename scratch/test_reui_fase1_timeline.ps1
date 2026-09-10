$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 1] Validação do Componente Event Timeline & Ciclo de Vida ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$timelinePath = Join-Path $root "src\components\ui\timeline.tsx"
$contratoRoutePath = Join-Path $root "src\routes\_authenticated\app.contratos.`$contratoId.tsx"

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

# 1. Verificar existência do componente Timeline
Assert-Condition "Arquivo src/components/ui/timeline.tsx existe" (Test-Path $timelinePath)

if (Test-Path $timelinePath) {
    $timelineContent = Get-Content $timelinePath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente Timeline" ($timelineContent -match "export const Timeline\b")
    Assert-Condition "Exporta componente TimelineItem" ($timelineContent -match "export const TimelineItem\b")
    Assert-Condition "Exporta componente TimelineIcon" ($timelineContent -match "export const TimelineIcon\b")
    Assert-Condition "Exporta componente TimelineHeader" ($timelineContent -match "export const TimelineHeader\b")
    Assert-Condition "Exporta componente TimelineTitle" ($timelineContent -match "export const TimelineTitle\b")
    Assert-Condition "Exporta componente TimelineTime" ($timelineContent -match "export const TimelineTime\b")
    Assert-Condition "Exporta componente TimelineDescription" ($timelineContent -match "export const TimelineDescription\b")
    Assert-Condition "Possui suporte a variantes semânticas (gold, success, warning, destructive)" ($timelineContent -match "variants\s*=\s*\{")
}

# 2. Verificar integração na rota de detalhes do contrato
Assert-Condition "Arquivo app.contratos.`$contratoId.tsx existe" (Test-Path $contratoRoutePath)

if (Test-Path $contratoRoutePath) {
    $routeContent = Get-Content $contratoRoutePath -Raw -Encoding UTF8
    Assert-Condition "Importa Timeline de @/components/ui/timeline" ($routeContent -match "from\s+[`"']@/components/ui/timeline[`"']")
    Assert-Condition "Renderiza <Timeline> na seção de Vigência" ($routeContent -match "<Timeline>")
    Assert-Condition "Renderiza evento Início da Vigência" ($routeContent -match "In.cio da Vig.ncia")
    Assert-Condition "Renderiza evento Reajuste Anual Programado" ($routeContent -match "Reajuste Anual Programado")
    Assert-Condition "Renderiza evento Janela Limite de Aviso Prévio" ($routeContent -match "Janela Limite de Aviso Pr.vio")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
