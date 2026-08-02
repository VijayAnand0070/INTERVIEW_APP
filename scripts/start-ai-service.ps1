Set-Location "$PSScriptRoot\..\ai-service"
$logDir = Join-Path (Get-Location) "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$stamp] Starting AI service on port 8000" | Add-Content (Join-Path $logDir "ai-service-start.log")
$logFile = Join-Path $logDir "ai-service-start.log"
cmd /c "".\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> "$logFile" 2>>&1"
$code = $LASTEXITCODE
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$stamp] AI service exited with code $code" | Add-Content (Join-Path $logDir "ai-service-start.log")
