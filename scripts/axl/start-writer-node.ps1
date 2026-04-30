param([string]$Root)

$args = @{ Role = "writer" }
if ($Root) { $args.Root = $Root }
& "$PSScriptRoot\Start-AxlNode.ps1" @args
