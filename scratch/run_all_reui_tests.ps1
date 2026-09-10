$ErrorActionPreference = "Stop"
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "   BATERIA COMPLETA DE TESTES: COMPONENTES REUI (FASES 1 A 6)" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

$root = "C:\Users\goesm\.gemini\antigravity\scratch\augustoij"
$scripts = @(
    "scratch/test_reui_fase1_timeline.ps1",
    "scratch/test_reui_fase2_faceted_filter.ps1",
    "scratch/test_reui_fase3_stepper.ps1",
    "scratch/test_reui_fase4_copy_snippet.ps1",
    "scratch/test_reui_fase5_callout_banner.ps1",
    "scratch/test_reui_fase6_kpi_card.ps1"
)

$allPassed = $true

foreach ($script in $scripts) {
    $fullPath = Join-Path $root $script
    if (Test-Path $fullPath) {
        & powershell -ExecutionPolicy Bypass -File $fullPath
        if ($LASTEXITCODE -ne 0) {
            $allPassed = $false
            Write-Host "  [FALHA NA SUÍTE]: $script" -ForegroundColor Red
        }
    } else {
        Write-Host "  [NÃO ENCONTRADO]: $script" -ForegroundColor Yellow
        $allPassed = $false
    }
}

Write-Host "`n============================================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "   STATUS GERAL: 100% SUCESSO - TODAS AS 6 FASES VALIDADAS" -ForegroundColor Green
} else {
    Write-Host "   STATUS GERAL: FALHAS DETECTADAS NAS SUÍTES REUI" -ForegroundColor Red
    exit 1
}
Write-Host "============================================================`n" -ForegroundColor Cyan
