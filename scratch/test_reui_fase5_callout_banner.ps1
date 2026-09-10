$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 5] Validação do Componente Critical Callout Banners ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$bannerPath = Join-Path $root "src\components\ui\callout-banner.tsx"
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

# 1. Verificar existência do componente CalloutBanner
Assert-Condition "Arquivo src/components/ui/callout-banner.tsx existe" (Test-Path $bannerPath)

if (Test-Path $bannerPath) {
    $bannerContent = Get-Content $bannerPath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente CalloutBanner" ($bannerContent -match "export const CalloutBanner\b")
    Assert-Condition "Suporta variantes semânticas (critical, warning, gold, success, info)" ($bannerContent -match "variantStyles")
    Assert-Condition "Suporta botão de CTA contextual com ação" ($bannerContent -match "action\.label")
    Assert-Condition "Suporta botão de fechar (dismissible)" ($bannerContent -match "dismissible")
    Assert-Condition "Suporta badge de status" ($bannerContent -match "badge")
}

# 2. Verificar integração no Painel de Contratos
Assert-Condition "Arquivo app.contratos.painel.tsx existe" (Test-Path $painelPath)

if (Test-Path $painelPath) {
    $painelContent = Get-Content $painelPath -Raw -Encoding UTF8
    Assert-Condition "Importa CalloutBanner de @/components/ui/callout-banner" ($painelContent -match "from\s+[`"']@/components/ui/callout-banner[`"']")
    Assert-Condition "Renderiza <CalloutBanner> para contratos vencidos/não conformidades" ($painelContent -match "variant=[`"']critical[`"']")
    Assert-Condition "Renderiza <CalloutBanner> para reajustes anuais pendentes" ($painelContent -match "variant=[`"']gold[`"']")
    Assert-Condition "Contém ação direta via CTA para tratar pendências" ($painelContent -match "handleOpenPendencia")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
