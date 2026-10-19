@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0.."
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -c "import yaml" >nul 2>nul || %PY% -m pip install pyyaml
echo Apply category migration
echo.
set /p OK=Preview done and OK? (y/n): 
if /i not "%OK%"=="y" exit /b
%PY% scripts\migrate_categories.py --apply > "scripts\last-report.txt" 2>&1
type "scripts\last-report.txt"
echo.
echo Full report: scripts\last-report.txt (open in an editor for correct Persian)
pause
