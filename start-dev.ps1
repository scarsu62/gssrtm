# Refresh PATH to ensure new Node/npm installation is recognized
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  RTM Development Server Launcher" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check and install backend dependencies
if (-not (Test-Path "backend/node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
} else {
    Write-Host "Backend dependencies already installed." -ForegroundColor Green
}

# Check and install frontend dependencies
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location frontend
    npm install
    Pop-Location
} else {
    Write-Host "Frontend dependencies already installed." -ForegroundColor Green
}

Write-Host "Starting Backend and Frontend in separate windows..." -ForegroundColor Yellow

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$env:Path'; Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force; cd backend; npm run dev" -WindowStyle Normal

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$env:Path'; Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force; cd frontend; npm run dev" -WindowStyle Normal

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Done! Backend should run on: http://localhost:5000" -ForegroundColor Green
Write-Host "Frontend should run on: http://localhost:5173" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
