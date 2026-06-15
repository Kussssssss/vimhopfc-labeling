$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8084

Write-Host "Serving Multi-hop Fact-checking Labeler"
Write-Host "Root: $root"
Write-Host "URL:  http://127.0.0.1:$port"
Write-Host ""
Write-Host "Press Ctrl+C to stop."

python.exe -m http.server $port --bind 127.0.0.1 --directory $root
