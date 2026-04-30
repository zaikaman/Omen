param([string]$Root)

$args = @{ Role = "orchestrator" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
