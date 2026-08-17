<#
  Repair the user PATH.

  WHY
  The user PATH has grown to ~26,100 characters across 221 entries. That
  overflows the environment block handed to child processes, so anything
  spawned through cmd.exe receives an ~11-character PATH. Symptoms:

      'node' is not recognized as an internal or external command
      'eslint' is not recognized ...

  which breaks `npm install` (prisma preinstall), `npx`, every
  node_modules\.bin\*.cmd shim, and husky/lint-staged git hooks — while
  `node --version` works fine in PowerShell, because PowerShell is not
  affected. Diagnose with:

      (cmd /c "echo %PATH%").Length          # ~11 when overflowing

  ROOT CAUSE
  193 of the 221 entries are the same leaked pattern:

      %LOCALAPPDATA%\Temp\pwv1-c10-compiler-<guid>\artifacts\
          AUTHORITY_BOUNDARY_RELEASE\dotnet-home\.dotnet\tools

  Some tool appends a per-run temp dotnet-tools directory to the persistent
  user PATH and never removes it. The directories are long gone; only the PATH
  entries remain. Two further entries (.dotnet\tools, go\bin) point at tools
  that are simply not installed.

  WHAT THIS DOES
  Keeps every entry that still exists on disk, drops duplicates and entries
  pointing at directories that do not exist. 221 entries -> 25, ~26,100 chars
  -> ~1,630. Nothing currently resolvable is removed.

  This only touches the USER PATH. The machine PATH is left alone.

  SAFETY
  Writes a timestamped backup first and prints the restore command. Run with
  -WhatIf to preview without changing anything.

  NOTE: already-running processes keep their old environment. Restart your
  terminal (and Claude Code) afterwards.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$BackupDir = "$env:USERPROFILE\path-backups"
)

$current = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $current) { throw 'Could not read the user PATH.' }

$entries = $current -split ';' | Where-Object { $_ -ne '' }
$unique  = $entries | Select-Object -Unique
$keep    = $unique | Where-Object { Test-Path $_ -ErrorAction SilentlyContinue }
$dropped = $unique | Where-Object { -not (Test-Path $_ -ErrorAction SilentlyContinue) }
$proposed = $keep -join ';'

Write-Host ''
Write-Host 'Current  : ' -NoNewline; Write-Host "$($current.Length) chars, $($entries.Count) entries"
Write-Host 'Proposed : ' -NoNewline; Write-Host "$($proposed.Length) chars, $($keep.Count) entries"
Write-Host 'Dropping : ' -NoNewline; Write-Host "$($dropped.Count) dead + $($entries.Count - $unique.Count) duplicate"
Write-Host ''
Write-Host 'Entries kept:' -ForegroundColor Green
$keep | ForEach-Object { Write-Host "  $_" }
Write-Host ''

if ($proposed.Length -ge $current.Length) { throw 'Proposed PATH is not shorter; aborting.' }
if ($keep.Count -lt 10) { throw "Only $($keep.Count) entries would survive; that looks wrong. Aborting." }

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $BackupDir "user-path-$stamp.txt"

if ($PSCmdlet.ShouldProcess('user PATH', "back up to $backup and replace with $($keep.Count) entries")) {
    Set-Content -LiteralPath $backup -Value $current -NoNewline -Encoding UTF8
    Write-Host "Backup written: $backup" -ForegroundColor Cyan

    [Environment]::SetEnvironmentVariable('Path', $proposed, 'User')

    Write-Host 'User PATH updated.' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Restore with:' -ForegroundColor Yellow
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', (Get-Content -Raw '$backup'), 'User')"
    Write-Host ''
    Write-Host 'Restart your terminal, then verify the fix:' -ForegroundColor Yellow
    Write-Host '  (cmd /c "echo %PATH%").Length     # should now be ~1600, not ~11'
    Write-Host '  cmd /c "node --version"           # should print the version'
}
