param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("orchestrator", "scanner", "research", "analyst", "critic", "market_bias", "chart_vision", "intel", "generator", "writer", "memory", "publisher")]
  [string]$Role,

  [string]$Root = "",
  [switch]$NoMcp,
  [switch]$NoA2A
)

$ErrorActionPreference = "Stop"

if (!$Root) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$roleConfig = @{
  orchestrator = @{ Api = 9002; Router = 9003; A2A = 9004; Tcp = 7000; Listen = 9101; Mcp = 7100; Service = "" }
  scanner      = @{ Api = 9012; Router = 9013; A2A = 9004; Tcp = 7000; Listen = 9111; Mcp = 7110; Service = "scanner" }
  research     = @{ Api = 9022; Router = 9023; A2A = 9004; Tcp = 7000; Listen = 9121; Mcp = 7120; Service = "research" }
  analyst      = @{ Api = 9032; Router = 9033; A2A = 9004; Tcp = 7000; Listen = 9131; Mcp = 7130; Service = "analyst" }
  critic       = @{ Api = 9042; Router = 9043; A2A = 9004; Tcp = 7000; Listen = 9141; Mcp = 7140; Service = "critic" }
  market_bias  = @{ Api = 9052; Router = 9053; A2A = 9004; Tcp = 7000; Listen = 9151; Mcp = 7150; Service = "market_bias" }
  chart_vision = @{ Api = 9062; Router = 9063; A2A = 9004; Tcp = 7000; Listen = 9161; Mcp = 7160; Service = "chart_vision" }
  intel        = @{ Api = 9072; Router = 9073; A2A = 9004; Tcp = 7000; Listen = 9171; Mcp = 7170; Service = "intel" }
  generator    = @{ Api = 9082; Router = 9083; A2A = 9004; Tcp = 7000; Listen = 9181; Mcp = 7180; Service = "generator" }
  writer       = @{ Api = 9092; Router = 9093; A2A = 9004; Tcp = 7000; Listen = 9191; Mcp = 7190; Service = "writer" }
  memory       = @{ Api = 9102; Router = 9103; A2A = 9004; Tcp = 7000; Listen = 9201; Mcp = 7200; Service = "memory" }
  publisher    = @{ Api = 9112; Router = 9113; A2A = 9004; Tcp = 7000; Listen = 9211; Mcp = 7210; Service = "publisher" }
}

$ports = $roleConfig[$Role]
$nodeExe = Join-Path $Root "local\axl\node.exe"
$axlSourceDir = Join-Path $Root "axl"
$runtimeDir = Join-Path $Root "local\axl\demo\$Role"
$logDir = Join-Path $Root "local\logs\axl-demo"
$integrationsPath = Join-Path $Root "axl\integrations"
$configPath = Join-Path $runtimeDir "node-config.json"
$peerIdPath = Join-Path $runtimeDir "peer-id.txt"
$pidPath = Join-Path $runtimeDir "pids.json"

function Quote-PowerShellString([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-LatestAxlSourceWriteTime {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir
  )

  $latest = Get-Item -Path (Join-Path $SourceDir "go.mod")
  $sourceFiles = Get-ChildItem -Path $SourceDir -Recurse -File -Include "*.go", "go.sum" -ErrorAction SilentlyContinue
  foreach ($file in $sourceFiles) {
    if ($file.LastWriteTimeUtc -gt $latest.LastWriteTimeUtc) {
      $latest = $file
    }
  }

  return $latest.LastWriteTimeUtc
}

function Build-AxlNode {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$OutputPath
  )

  if (!(Test-Path (Join-Path $SourceDir "go.mod"))) {
    throw "AXL source folder not found at $SourceDir"
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null

  $buildCommand = @(
    "`$env:GOTOOLCHAIN='go1.25.5'",
    "go build -o $(Quote-PowerShellString $OutputPath) .\cmd\node"
  ) -join "; "

  Write-Host "Building AXL node from $SourceDir"
  $process = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $buildCommand) -WorkingDirectory $SourceDir -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Failed to build AXL node from $SourceDir. Run with GOTOOLCHAIN=go1.25.5 for details."
  }
}

if (!(Test-Path $nodeExe)) {
  Build-AxlNode -SourceDir $axlSourceDir -OutputPath $nodeExe
} else {
  $nodeWriteTime = (Get-Item -Path $nodeExe).LastWriteTimeUtc
  $sourceWriteTime = Get-LatestAxlSourceWriteTime -SourceDir $axlSourceDir
  if ($sourceWriteTime -gt $nodeWriteTime) {
    Build-AxlNode -SourceDir $axlSourceDir -OutputPath $nodeExe
  }
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $logDir | Out-Null
Get-ChildItem -Path $logDir -Filter "$Role-*.log" -File -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

$bootstrapPeers = @(
  "tls://34.46.48.224:9001",
  "tls://136.111.135.206:9001"
)
$localPeers = @()
foreach ($entry in $roleConfig.GetEnumerator()) {
  if ($entry.Key -ne $Role) {
    $localPeers += "tls://127.0.0.1:$($entry.Value.Listen)"
  }
}

$nodeConfig = [ordered]@{
  Peers = @($bootstrapPeers + $localPeers)
  Listen = @("tls://127.0.0.1:$($ports.Listen)")
  bridge_addr = "127.0.0.1"
  api_port = $ports.Api
  tcp_port = $ports.Tcp
  router_addr = "http://127.0.0.1"
  router_port = $ports.Router
  a2a_addr = "http://127.0.0.1"
  a2a_port = $ports.A2A
  a2a_peer_timeout_secs = 300
  mcp_peer_timeout_secs = 300
}

$privateKeyPath = Join-Path $runtimeDir "private.pem"
if (Test-Path $privateKeyPath) {
  $nodeConfig.PrivateKeyPath = $privateKeyPath
}

$nodeConfig | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding ASCII
if (Test-Path $peerIdPath) {
  Remove-Item -Path $peerIdPath -Force
}

function Start-LoggedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList
  )

  $stdout = Join-Path $logDir "$Role-$Name.out.log"
  $stderr = Join-Path $logDir "$Role-$Name.err.log"
  $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $Root -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
  return [ordered]@{
    name = $Name
    pid = $process.Id
    stdout = $stdout
    stderr = $stderr
  }
}

$started = @()

$routerCommand = "`$env:PYTHONPATH=$(Quote-PowerShellString $integrationsPath); `$env:MCP_ROUTER_FORWARD_TIMEOUT_SECS='300'; python -m mcp_routing.mcp_router --port $($ports.Router) --forward-timeout-secs 300"
$started += Start-LoggedProcess -Name "router" -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $routerCommand)
Start-Sleep -Milliseconds 700

if (!$NoMcp -and $ports.Service) {
  $mcpCommand = @(
    "`$env:OMEN_MCP_HOST='127.0.0.1'",
    "`$env:OMEN_MCP_PORT='$($ports.Mcp)'",
    "`$env:OMEN_MCP_ROUTER_URL='http://127.0.0.1:$($ports.Router)'",
    "`$env:OMEN_MCP_PUBLIC_BASE_URL='http://127.0.0.1:$($ports.Mcp)'",
    "`$env:OMEN_MCP_SERVICES='$($ports.Service)'",
    "pnpm --dir backend run mcp:host"
  ) -join "; "
  $started += Start-LoggedProcess -Name "mcp" -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $mcpCommand)
  Start-Sleep -Milliseconds 700
}

$started += Start-LoggedProcess -Name "node" -FilePath $nodeExe -ArgumentList @("-config", $configPath)
Start-Sleep -Milliseconds 1200

if (!$NoA2A -and $Role -eq "orchestrator") {
  $a2aCommand = @(
    "`$env:OMEN_A2A_HOST='127.0.0.1'",
    "`$env:OMEN_A2A_PORT='$($ports.A2A)'",
    "`$env:OMEN_A2A_AXL_API_BASE_URL='http://127.0.0.1:$($ports.Api)'",
    "`$env:OMEN_A2A_DEMO_DIR=$(Quote-PowerShellString (Join-Path $Root 'local\axl\demo'))",
    "`$env:OMEN_A2A_MCP_TIMEOUT_MS='300000'",
    "pnpm --dir backend run a2a:callback-adapter"
  ) -join "; "
  $started += Start-LoggedProcess -Name "a2a-callback-adapter" -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $a2aCommand)
}

$started | ConvertTo-Json -Depth 4 | Set-Content -Path $pidPath -Encoding ASCII

$peerId = $null
for ($attempt = 1; $attempt -le 30; $attempt += 1) {
  try {
    $topology = Invoke-RestMethod -Uri "http://127.0.0.1:$($ports.Api)/topology" -TimeoutSec 2
    if ($topology.our_public_key) {
      $peerId = [string]$topology.our_public_key
      $peerId | Set-Content -Path $peerIdPath -Encoding ASCII
      break
    }
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

Write-Host "Started AXL $Role node"
Write-Host "  API:    http://127.0.0.1:$($ports.Api)"
Write-Host "  Router: http://127.0.0.1:$($ports.Router)"
Write-Host "  A2A:    http://127.0.0.1:$($ports.A2A)"
if ($ports.Service) {
  Write-Host "  MCP:    $($ports.Service) on http://127.0.0.1:$($ports.Mcp)"
}
Write-Host "  Logs:   $logDir"
if ($peerId) {
  Write-Host "  Peer:   $peerId"
} else {
  Write-Warning "Peer id not available yet. Check $($Role)-node logs."
}
