$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 2] Validação do Componente Faceted Filter Bar & Chips ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$filterPath = Join-Path $root "src\components\ui\faceted-filter.tsx"
$contratosIndexPath = Join-Path $root "src\routes\_authenticated\app.contratos.index.tsx"

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

# 1. Verificar existência do componente FacetedFilter
Assert-Condition "Arquivo src/components/ui/faceted-filter.tsx existe" (Test-Path $filterPath)

if (Test-Path $filterPath) {
    $filterContent = Get-Content $filterPath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente FacetedFilter" ($filterContent -match "export function FacetedFilter\b")
    Assert-Condition "Exporta componente FacetedFilterChip" ($filterContent -match "export function FacetedFilterChip\b")
    Assert-Condition "Integra com Popover e Command do shadcn" ($filterContent -match "Popover" -and $filterContent -match "Command")
    Assert-Condition "Suporta contadores de seleções ativas" ($filterContent -match "selectedSet\.size")
    Assert-Condition "Suporta modo de seleção única e múltipla" ($filterContent -match "singleSelect")
}

# 2. Verificar integração na listagem de contratos
Assert-Condition "Arquivo app.contratos.index.tsx existe" (Test-Path $contratosIndexPath)

if (Test-Path $contratosIndexPath) {
    $indexContent = Get-Content $contratosIndexPath -Raw -Encoding UTF8
    Assert-Condition "Importa FacetedFilter de @/components/ui/faceted-filter" ($indexContent -match "from\s+[`"']@/components/ui/faceted-filter[`"']")
    Assert-Condition "Renderiza FacetedFilter para Condomínio" ($indexContent -match "title=[`"']Condom.nio[`"']")
    Assert-Condition "Renderiza FacetedFilter para Tipo de Serviço" ($indexContent -match "title=[`"']Tipo de Servi.o[`"']")
    Assert-Condition "Renderiza FacetedFilter para Status" ($indexContent -match "title=[`"']Status[`"']")
    Assert-Condition "Renderiza FacetedFilterChip para filtros ativos" ($indexContent -match "<FacetedFilterChip")
    Assert-Condition "Possui botão de Limpar filtros com RotateCcw" ($indexContent -match "RotateCcw")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
