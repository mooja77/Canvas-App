param([Parameter(Mandatory=$true)][string]$EvidenceRoot, [Parameter(Mandatory=$true)][string]$ChromiumExecutable)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runPath = Join-Path $EvidenceRoot (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Force -Path $runPath | Out-Null
$monitorExit = 1
try {
    if (!(Test-Path -LiteralPath $ChromiumExecutable -PathType Leaf)) { throw 'Configured Chromium executable is missing.' }
    $env:E2E_CHROMIUM = $ChromiumExecutable
    & node (Join-Path $PSScriptRoot 'entry-check.mjs') $runPath *> (Join-Path $runPath 'run.log')
    $monitorExit = $LASTEXITCODE
} catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $runPath 'run.log')
}
if ($monitorExit -ne 0) {
    $title = '[new-customer] QualCanvas public entry check failed'
    $bodyPath = Join-Path $runPath 'alert.md'
    @("Weekly read-only public entry check failed at $(Get-Date -Format o).", '',
      "Machine evidence: $runPath", '',
      'Scope: public landing, pricing, sign-up entry, contact and training at 1440px and 390px.',
      'This monitor does not certify authenticated installation or first coded excerpt. No accounts or production data are changed.', '',
      'Review result.json and run.log on the runner. An infrastructure failure also produces this alert; do not assume a product regression.') | Set-Content -LiteralPath $bodyPath
    & gh issue list --repo mooja77/Canvas-App --state open --search $title --json number,title --limit 100 > (Join-Path $runPath 'issues.json')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing alert issues; see runner evidence.' }
    $existing = @(Get-Content -Raw -LiteralPath (Join-Path $runPath 'issues.json') | ConvertFrom-Json) | Where-Object title -eq $title | Select-Object -First 1
    if ($existing) {
        & gh issue edit $existing.number --repo mooja77/Canvas-App --body-file $bodyPath *> (Join-Path $runPath 'alert.log')
    } else {
        & gh issue create --repo mooja77/Canvas-App --title $title --body-file $bodyPath *> (Join-Path $runPath 'alert.log')
    }
    if ($LASTEXITCODE -ne 0) { throw 'GitHub issue alert failed; see runner evidence.' }
}
@{ finishedAt=(Get-Date -Format o); monitorExit=$monitorExit; authenticatedJourneyVerified=$false } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runPath 'runner-result.json')
exit $monitorExit
