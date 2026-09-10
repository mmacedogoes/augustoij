$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 4] Validação do Componente Copy Snippet & Action Block ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$snippetPath = Join-Path $root "src\components\ui\copy-snippet.tsx"
$chatContratoPath = Join-Path $root "src\components\contratos-servico\ChatContratoPanel.tsx"

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

# 1. Verificar existência do componente CopySnippet
Assert-Condition "Arquivo src/components/ui/copy-snippet.tsx existe" (Test-Path $snippetPath)

if (Test-Path $snippetPath) {
    $snippetContent = Get-Content $snippetPath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente CopySnippet" ($snippetContent -match "export const CopySnippet\b")
    Assert-Condition "Suporta cópia com navigator.clipboard e feedback de toast" ($snippetContent -match "navigator\.clipboard\.writeText")
    Assert-Condition "Suporta download de arquivo de texto" ($snippetContent -match "downloadFileName")
    Assert-Condition "Suporta variantes visuais (default, bordered, ghost, gold)" ($snippetContent -match "variantClasses")
}

# 2. Verificar integração no chat de contratos
Assert-Condition "Arquivo ChatContratoPanel.tsx existe" (Test-Path $chatContratoPath)

if (Test-Path $chatContratoPath) {
    $chatContent = Get-Content $chatContratoPath -Raw -Encoding UTF8
    Assert-Condition "Importa CopySnippet de @/components/ui/copy-snippet" ($chatContent -match "from\s+[`"']@/components/ui/copy-snippet[`"']")
    Assert-Condition "Renderiza <CopySnippet> para minutas geradas pela IA" ($chatContent -match "<CopySnippet")
    Assert-Condition "Configura downloadFileName no CopySnippet" ($chatContent -match "downloadFileName=")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
