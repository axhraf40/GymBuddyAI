# Starts n8n locally for the GymBuddy workflows.
# Secrets are read from backend\.env (never stored here). Usage, from the project folder:
#   powershell -ExecutionPolicy Bypass -File automation\start-n8n.ps1            # uses the live API
#   powershell -ExecutionPolicy Bypass -File automation\start-n8n.ps1 -Local     # uses http://localhost:8000
param([switch]$Local)

$envFile = Join-Path $PSScriptRoot "..\backend\.env"
$vals = @{}
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } | ForEach-Object {
    $vals[$Matches[1]] = $Matches[2].Trim()
  }
}

$env:GYMBUDDY_API_URL = if ($Local) { "http://localhost:8000" } else { "https://gymbuddy-api-zeta.vercel.app" }
$env:GYMBUDDY_API_KEY = $vals["AUTOMATION_API_KEY"]
$env:LLM_ENDPOINT     = "https://openrouter.ai/api/v1/chat/completions"
$env:LLM_MODEL        = "openrouter/free"
$env:LLM_MAX_TOKENS   = "1500"
$env:LLM_API_KEY      = $vals["OPENROUTER_API_KEY"]
if (-not $env:SMTP_FROM_EMAIL)     { $env:SMTP_FROM_EMAIL = "" }
if (-not $env:ADMIN_ALERT_EMAIL)   { $env:ADMIN_ALERT_EMAIL = "" }
if (-not $env:CRM_GOOGLE_SHEET_ID) { $env:CRM_GOOGLE_SHEET_ID = "" }

# The workflows read these with $env.X, so expressions must be allowed to read env vars.
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE = "false"
$env:GENERIC_TIMEZONE = "Africa/Casablanca"
$env:N8N_SECURE_COOKIE = "false"

Write-Host "n8n -> http://localhost:5678  (API: $($env:GYMBUDDY_API_URL))"
npx -y n8n start
