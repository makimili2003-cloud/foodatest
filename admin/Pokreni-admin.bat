@echo off
cd /d "%~dp0"
title FoodAR admin
where node >nul 2>nul || (echo Node.js nije instaliran. Preuzmi ga sa https://nodejs.org (LTS verzija^) & pause & exit /b)
if not exist node_modules (echo Instaliram pakete, samo prvi put... & call npm install --no-audit --no-fund)
if not exist .env (copy .env.example .env >nul & echo Napravljen je fajl .env - otvori ga i upisi GITHUB_TOKEN i ADMIN_PIN, pa pokreni ponovo. & notepad .env & pause & exit /b)
node server.js
pause
