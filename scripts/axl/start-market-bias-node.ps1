param([string]$Root)

$args = @{ Role = "market_bias" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
