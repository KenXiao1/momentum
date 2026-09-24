$ErrorActionPreference = "Stop"
# Keep the legacy PowerShell entry point on the same fail-closed implementation.
& node (Join-Path $PSScriptRoot "run-semgrep.mjs")
exit $LASTEXITCODE
