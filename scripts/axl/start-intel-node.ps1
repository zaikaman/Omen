param([string]$Root)

$args = @{ Role = "intel" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
