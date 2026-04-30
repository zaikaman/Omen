param([string]$Root)

$args = @{ Role = "critic" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
