param([string]$Root)

$args = @{ Role = "chart_vision" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
