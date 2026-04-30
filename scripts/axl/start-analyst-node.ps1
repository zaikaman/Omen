param([string]$Root)

$args = @{ Role = "analyst" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
