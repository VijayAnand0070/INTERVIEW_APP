$ErrorActionPreference = "Stop"

$envPath = Join-Path "$PSScriptRoot\..\ai-service" ".env"
if (!(Test-Path $envPath)) {
  throw "Missing ai-service/.env"
}

$key = Read-Host "Paste GROQ_API_KEY"
if ([string]::IsNullOrWhiteSpace($key)) {
  throw "GROQ_API_KEY cannot be empty"
}

$lines = Get-Content $envPath
$updated = $false
$next = foreach ($line in $lines) {
  if ($line -match "^GROQ_API_KEY=") {
    $updated = $true
    "GROQ_API_KEY=$key"
  } else {
    $line
  }
}

if (!$updated) {
  $next += "GROQ_API_KEY=$key"
}

Set-Content -Path $envPath -Value $next
Write-Host "GROQ_API_KEY saved to ai-service/.env. Restart the AI service after this."
