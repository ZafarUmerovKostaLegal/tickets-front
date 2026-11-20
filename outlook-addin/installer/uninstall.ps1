[CmdletBinding()]
param([switch]$Quiet)

$ErrorActionPreference = 'Continue'
$AppName = 'Kosta File for Office'
$AppDir = Join-Path $env:LOCALAPPDATA 'Kosta\KostaFile'
$DeveloperKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'

if (Test-Path -LiteralPath $DeveloperKey) {
    $props = Get-ItemProperty -LiteralPath $DeveloperKey
    foreach ($prop in $props.PSObject.Properties) {
        if ($prop.Value -is [string] -and $prop.Value -like "$AppDir*") {
            Remove-ItemProperty -LiteralPath $DeveloperKey -Name $prop.Name -ErrorAction SilentlyContinue
        }
    }
}
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'KostaFileOffice' -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KostaFileOffice' -Recurse -Force -ErrorAction SilentlyContinue

Start-Process -WindowStyle Hidden cmd.exe -ArgumentList "/c timeout /t 2 >nul & rmdir /s /q `"$AppDir`""

if (-not $Quiet) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Kosta File удалён из Word, Excel и PowerPoint. Кнопка исчезнет после перезапуска Office.",
        $AppName, 'OK', 'Information') | Out-Null
}
