param([string]$Root)

$args = @{ Role = "memory" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
