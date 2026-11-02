$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'start-vision.ps1') -Stop -NoBrowser
exit $LASTEXITCODE
