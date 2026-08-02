@echo off
cd /d "%~dp0..\ai-service"
if not exist logs mkdir logs
echo [%date% %time%] Starting AI service on port 8000>> logs\ai-service-start.log
".\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> logs\ai-service-start.log 2>&1
echo [%date% %time%] AI service exited with code %ERRORLEVEL%>> logs\ai-service-start.log
