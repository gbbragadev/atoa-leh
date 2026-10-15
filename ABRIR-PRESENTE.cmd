@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24 e abra este arquivo novamente.
  echo https://nodejs.org/
  pause
  exit /b 1
)
call npm.cmd run presente
set "PRESENTE_EXIT=%ERRORLEVEL%"
if not "%PRESENTE_EXIT%"=="0" (
  echo.
  echo O presente não abriu. Confira a mensagem acima e o README.md.
  pause
)
exit /b %PRESENTE_EXIT%
