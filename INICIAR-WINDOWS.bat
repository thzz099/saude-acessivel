@echo off
chcp 65001 > nul
title SaudeMap IA - Iniciar sistema local
cd /d "%~dp0"

echo ============================================
echo   SaudeMap IA - Inicializacao local
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado neste computador.
    echo Instale em https://nodejs.org ^(versao LTS^)
    echo OU use o site no ar: https://saude-acessivel.onrender.com
    pause
    exit /b 1
)
echo [OK] Node.js:
node --version
echo.

if not exist ".env" (
    echo [ERRO] Arquivo .env nao encontrado.
    echo Copie o .env.example para .env e preencha as credenciais.
    echo Veja LEIA-ME.md na pasta principal.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar. Use o site no ar: https://saude-acessivel.onrender.com
        pause
        exit /b 1
    )
)

echo.
echo   Acesse: http://localhost:3000/login.html
echo   Para parar: Ctrl+C
echo.
node server.js
pause
