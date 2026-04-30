param([string]$Root)

$args = @{ Role = "generator" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
