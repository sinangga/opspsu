param(
  [string]$Pm2Home = "C:\Users\UPT-Admin\.pm2",
  [string]$Pm2Cmd = "C:\Users\UPT-Admin\AppData\Roaming\npm\pm2.cmd",
  [string]$NodeCmd = "C:\Program Files\nodejs\node.exe",
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Pm2Home)) {
  New-Item -ItemType Directory -Path $Pm2Home | Out-Null
}

$logPath = Join-Path $Pm2Home "watchdog.log"
$lockPath = Join-Path $Pm2Home "watchdog.lock"
$dumpPath = Join-Path $Pm2Home "dump.pm2"

function Write-WatchdogLog {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$timestamp] $Message"
}

function Invoke-ProcessWithTimeout {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [int]$Timeout
  )

  $stdout = Join-Path $env:TEMP ("pm2-watchdog-out-{0}.log" -f ([guid]::NewGuid()))
  $stderr = Join-Path $env:TEMP ("pm2-watchdog-err-{0}.log" -f ([guid]::NewGuid()))

  try {
    $process = Start-Process `
      -FilePath $FilePath `
      -ArgumentList $ArgumentList `
      -WorkingDirectory (Split-Path -Parent $PSScriptRoot) `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr `
      -PassThru

    if (-not $process.WaitForExit($Timeout * 1000)) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      throw "timeout after $Timeout seconds: $FilePath $($ArgumentList -join ' ')"
    }

    $out = if (Test-Path -LiteralPath $stdout) { Get-Content -LiteralPath $stdout -Raw } else { "" }
    $err = if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Raw } else { "" }
    if ($null -eq $out) { $out = "" }
    if ($null -eq $err) { $err = "" }

    $process.Refresh()
    $exitCode = if ($null -eq $process.ExitCode) { 0 } else { $process.ExitCode }

    return @{
      ExitCode = $exitCode
      Stdout = $out.Trim()
      Stderr = $err.Trim()
    }
  } finally {
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  }
}

function Get-DumpApps {
  if (-not (Test-Path -LiteralPath $dumpPath)) {
    throw "dump file not found: $dumpPath"
  }

  $parser = @"
const fs = require('fs');
const dumpPath = process.argv[1];
const data = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
console.log(data.map(app => [app.name || '', app.pm_exec_path || ''].join('\t')).join('\n'));
"@

  $output = & $NodeCmd -e $parser $dumpPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "failed to parse dump.pm2: $($output -join [Environment]::NewLine)"
  }

  foreach ($line in @($output)) {
    if (-not $line) {
      continue
    }
    $parts = $line -split "`t", 2
    [pscustomobject]@{
      name = $parts[0]
      script = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    }
  }
}

function Convert-Pm2Jlist {
  param([string]$Json)

  $jsonPath = Join-Path $env:TEMP ("pm2-watchdog-jlist-{0}.json" -f ([guid]::NewGuid()))
  try {
    [System.IO.File]::WriteAllText($jsonPath, $Json, [System.Text.UTF8Encoding]::new($false))

    $parser = @"
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
console.log(data.map(app => [
  app.name || '',
  app.pm2_env && app.pm2_env.status ? app.pm2_env.status : 'unknown',
  app.pid || 0
].join('\t')).join('\n'));
"@

    $output = & $NodeCmd -e $parser $jsonPath 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "failed to parse pm2 jlist: $($output -join [Environment]::NewLine)"
    }

    foreach ($line in @($output)) {
      if (-not $line) {
        continue
      }
      $parts = $line -split "`t", 3
      [pscustomobject]@{
        name = $parts[0]
        status = if ($parts.Count -gt 1) { $parts[1] } else { "unknown" }
        pid = if ($parts.Count -gt 2) { $parts[2] } else { 0 }
      }
    }
  } finally {
    Remove-Item -LiteralPath $jsonPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-Pm2AppStatus {
  $result = Invoke-ProcessWithTimeout -FilePath $Pm2Cmd -ArgumentList @("jlist") -Timeout $TimeoutSeconds
  if ($result.ExitCode -ne 0) {
    throw "pm2 jlist failed: exit=$($result.ExitCode); stderr=$($result.Stderr); stdout=$($result.Stdout)"
  }

  return @(Convert-Pm2Jlist -Json $result.Stdout)
}

$lock = $null

try {
  $lock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
  Write-WatchdogLog "skip: another watchdog run is still active"
  exit 0
}

try {
  $env:PM2_HOME = $Pm2Home
  $env:USERPROFILE = "C:\Users\UPT-Admin"
  $env:HOME = "C:\Users\UPT-Admin"
  $env:APPDATA = "C:\Users\UPT-Admin\AppData\Roaming"
  $env:LOCALAPPDATA = "C:\Users\UPT-Admin\AppData\Local"

  if (-not (Test-Path -LiteralPath $Pm2Cmd)) {
    throw "pm2 command not found: $Pm2Cmd"
  }

  $apps = @(Get-DumpApps)
  if ($apps.Count -eq 0) {
    throw "dump.pm2 does not contain any apps"
  }

  $runningApps = @()
  $healthError = $null
  try {
    $runningApps = @(Get-Pm2AppStatus)
  } catch {
    $healthError = $_.Exception.Message
  }

  $missing = @()
  if ($healthError) {
    $missing += "pm2 health check failed <$healthError>"
  } else {
    foreach ($app in $apps) {
      $runningApp = $runningApps | Where-Object { $_.name -eq $app.name } | Select-Object -First 1

      if (-not $runningApp) {
        $missing += "$($app.name) <missing>"
      } elseif ($runningApp.status -ne "online") {
        $missing += "$($app.name) <$($runningApp.status)>"
      }
    }
  }

  if ($missing.Count -eq 0) {
    Write-WatchdogLog "ok: pm2 daemon and $($apps.Count) app(s) are running"
    exit 0
  }

  $reason = @()
  if ($missing.Count -gt 0) {
    $reason += "missing app(s): $($missing -join ', ')"
  }

  Write-WatchdogLog "recover: $($reason -join '; ')"
  $resurrect = Invoke-ProcessWithTimeout -FilePath $Pm2Cmd -ArgumentList @("resurrect") -Timeout $TimeoutSeconds

  if ($resurrect.ExitCode -ne 0) {
    $stderr = if ($resurrect.Stderr.Length -gt 500) { $resurrect.Stderr.Substring(0, 500) } else { $resurrect.Stderr }
    $stdout = if ($resurrect.Stdout.Length -gt 500) { $resurrect.Stdout.Substring(0, 500) } else { $resurrect.Stdout }
    Write-WatchdogLog "resurrect failed: exit=$($resurrect.ExitCode); stderr=$stderr; stdout=$stdout"
    exit $resurrect.ExitCode
  }

  Write-WatchdogLog "resurrect completed"
} catch {
  Write-WatchdogLog "error: $($_.Exception.Message) at $($_.InvocationInfo.ScriptLineNumber):$($_.InvocationInfo.OffsetInLine)"
  exit 1
} finally {
  if ($lock) {
    $lock.Dispose()
  }
}
