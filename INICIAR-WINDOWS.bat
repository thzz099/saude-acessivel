@echo off
chcp 65001 > nul
title SaudeMap IA
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^)
    echo        ou use o site no ar: https://saude-acessivel.onrender.com
    pause
    exit /b 1
)
if not exist ".env" (
    echo [ERRO] Arquivo .env nao encontrado. Copie .env.example para .env e preencha.
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install || (pause & exit /b 1)
)
echo.
echo   Portal:  http://localhost:3000
echo   Admin:   http://localhost:3000/admin
echo   Parar:   Ctrl+C
echo.
call npm start
pause
