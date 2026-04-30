param(
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"

if (!$Root) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$demoDir = Join-Path $Root "local\axl\demo"
if (!(Test-Path $demoDir)) {
  Write-Host "No AXL demo runtime directory found."
  return
}

$pidFiles = Get-ChildItem -Path $demoDir -Recurse -Filter "pids.json" -File
foreach ($pidFile in $pidFiles) {
  $role = Split-Path -Path $pidFile.DirectoryName -Leaf
  $entries = Get-Content -Path $pidFile.FullName -Raw | ConvertFrom-Json

  foreach ($entry in $entries) {
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($process) {
      Write-Host "Stopping AXL $role $($entry.name) process $($entry.pid)"
      Stop-Process -Id $entry.pid -Force
    }
  }

  Remove-Item -Path $pidFile.FullName -Force
}

$demoPorts = @(
  9002, 9003, 9004,
  7100, 7110, 7120, 7130, 7140, 7150, 7160, 7170, 7180, 7190, 7200, 7210,
  9012, 9013, 9014,
  9022, 9023, 9024,
  9032, 9033, 9034,
  9042, 9043, 9044,
  9052, 9053, 9054,
  9062, 9063, 9064,
  9072, 9073, 9074,
  9082, 9083, 9084,
  9092, 9093, 9094,
  9102, 9103, 9104,
  9112, 9113, 9114
)

foreach ($port in $demoPorts) {
  $connections = netstat -ano | Select-String -Pattern ":$port\s"
  foreach ($connection in $connections) {
    $columns = ($connection.Line -split "\s+") | Where-Object { $_ }
    if ($columns.Length -lt 5 -or $columns[3] -ne "LISTENING") {
      continue
    }
    $processId = [int]($columns[-1])
    if ($processId -le 0) {
      continue
    }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Write-Host "Stopping process $processId on AXL demo port $port"
      Stop-Process -Id $processId -Force
    }
  }
}

Write-Host "AXL demo swarm stopped."
