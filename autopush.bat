@echo off
title Auto Git Push (Ctrl+C to stop)
echo Auto-push running. Press Ctrl+C to stop.
:loop
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "[auto] %date% %time%"
  git push
  echo Pushed at %time% on %date%
)
timeout /t 5 >nul
goto loop
