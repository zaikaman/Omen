param([string]$Root)

$args = @{ Role = "research" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
