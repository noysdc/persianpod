@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -c "import yaml" >nul 2>nul || %PY% -m pip install pyyaml
echo اعتبارسنجی دسته‌ها
echo.
%PY% tools\validate_podcasts.py > "tools\last-report.txt" 2>&1
type "tools\last-report.txt"
echo.
echo (گزارش کامل در tools\last-report.txt ذخیره شد؛ با یک ویرایشگر باز کنید تا فارسی درست نمایش داده شود)
pause
