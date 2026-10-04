# Saul - Legal AI Assistant
# Windows PowerShell startup script

Write-Host ""
Write-Host "  ⚖️  SAUL - Legal AI Assistant" -ForegroundColor Yellow
Write-Host "  Starting backend and frontend..." -ForegroundColor Cyan
Write-Host ""

# Check for .env files
if (-not (Test-Path "backend\.env")) {
    Write-Host "  ⚠️  backend\.env not found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "  👉 Please edit backend\.env and add your OPENAI_API_KEY, then re-run this script." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\.env")) {
    Write-Host "  ℹ️  frontend\.env not found. Copying from .env.example..." -ForegroundColor Cyan
    Copy-Item "frontend\.env.example" "frontend\.env"
}

# Check Node modules
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "  📦 Installing frontend dependencies..." -ForegroundColor Cyan
    Set-Location frontend
    npm install
    Set-Location ..
}

# Start backend in a new PowerShell window
Write-Host "  🐍 Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

Start-Sleep -Seconds 2

# Start frontend in a new PowerShell window
Write-Host "  ⚛️  Starting React frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "  ✅ Saul is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "  📖 Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  📖 API Docs:     http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  🌐 Frontend:     http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Close the opened terminal windows to stop the servers." -ForegroundColor Gray
Write-Host ""
