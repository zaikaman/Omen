param([string]$Root)

$args = @{ Role = "scanner" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
