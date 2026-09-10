$ErrorActionPreference = "Stop"
Write-Host "`n=== [TESTE REUI FASE 3] Validação do Componente Multi-Step Stepper ===" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$stepperPath = Join-Path $root "src\components\ui\stepper.tsx"
$formPath = Join-Path $root "src\components\contratos-servico\ContratoForm.tsx"

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

# 1. Verificar existência do componente Stepper
Assert-Condition "Arquivo src/components/ui/stepper.tsx existe" (Test-Path $stepperPath)

if (Test-Path $stepperPath) {
    $stepperContent = Get-Content $stepperPath -Raw -Encoding UTF8
    Assert-Condition "Exporta componente Stepper" ($stepperContent -match "export const Stepper\b")
    Assert-Condition "Exporta componente Step" ($stepperContent -match "export const Step\b")
    Assert-Condition "Suporta activeStep e onStepClick" ($stepperContent -match "activeStep" -and $stepperContent -match "onStepClick")
    Assert-Condition "Renderiza indicador com número ou ícone de conclusão Check" ($stepperContent -match "<Check")
}

# 2. Verificar integração no ContratoForm
Assert-Condition "Arquivo ContratoForm.tsx existe" (Test-Path $formPath)

if (Test-Path $formPath) {
    $formContent = Get-Content $formPath -Raw -Encoding UTF8
    Assert-Condition "Importa Stepper de @/components/ui/stepper" ($formContent -match "from\s+[`"']@/components/ui/stepper[`"']")
    Assert-Condition "Define estado activeStep" ($formContent -match "activeStep")
    Assert-Condition "Renderiza 4 etapas no Stepper" ($formContent -match "Prestador & Objeto" -and $formContent -match "Vig.ncia & Prazos" -and $formContent -match "Valores & Reajuste" -and $formContent -match "Cl.usulas & Revis.o")
    Assert-Condition "Contém funções de navegação handleAvancar e handleVoltar" ($formContent -match "handleAvancar" -and $formContent -match "handleVoltar")
    Assert-Condition "Renderiza resumo da ficha no passo de revisão" ($formContent -match "Resumo da Ficha do Contrato")
}

Write-Host "`nResultado: $passed passou, $failed falhou." -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) {
    exit 1
}
