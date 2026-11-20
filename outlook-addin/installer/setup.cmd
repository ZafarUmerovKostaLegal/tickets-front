@echo off
rem Kosta File for Office: started by the self-extracting package (or double-click).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
