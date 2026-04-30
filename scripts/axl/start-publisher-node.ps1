param([string]$Root)

$args = @{ Role = "publisher" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
