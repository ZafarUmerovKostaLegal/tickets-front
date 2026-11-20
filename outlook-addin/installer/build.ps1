<#
  Builds KostaFileForOffice.exe — a self-extracting package made with IExpress (part of Windows).
  It carries install.ps1 / uninstall.ps1 and the current production manifests (offline fallback;
  online the installer always takes the newest manifests from the Hub).

    powershell -ExecutionPolicy Bypass -File installer\build.ps1
    npm run installer

  The name avoids "setup"/"install": Windows would treat such an exe as an installer and ask for
  administrator rights, and the add-in would then land in the admin's profile instead of the user's.
  Sign the exe (signtool) before handing it out, otherwise SmartScreen warns about an unknown publisher.
#>
[CmdletBinding()]
param([string]$OutDir)

$ErrorActionPreference = 'Stop'
$Here = $PSScriptRoot
$Root = Split-Path $Here -Parent
if (-not $OutDir) { $OutDir = Join-Path $Here 'out' }
$Target = Join-Path $OutDir 'KostaFileForOffice.exe'

$iexpress = Join-Path $env:WINDIR 'System32\iexpress.exe'
if (-not (Test-Path -LiteralPath $iexpress)) { throw 'IExpress не найден (нужна Windows).' }

$files = @(
    (Join-Path $Here 'setup.cmd'),
    (Join-Path $Here 'install.ps1'),
    (Join-Path $Here 'uninstall.ps1'),
    (Join-Path $Root 'KostaFile.manifest.xml'),
    (Join-Path $Root 'KostaFile.Office.manifest.xml')
)
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Нет файла $file" }
}

# IExpress takes one flat source folder and is happiest with short paths.
$stage = Join-Path $env:TEMP ("kfpkg_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
foreach ($file in $files) { Copy-Item -LiteralPath $file -Destination $stage }

$names = $files | ForEach-Object { Split-Path $_ -Leaf }
$fileLines = for ($i = 0; $i -lt $names.Count; $i++) { "FILE$i=`"$($names[$i])`"" }
$sourceLines = for ($i = 0; $i -lt $names.Count; $i++) { "%FILE$i%=" }
$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$Target
FriendlyName=Kosta File for Office
AppLaunched=cmd.exe /c setup.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=cmd.exe /c setup.cmd -Quiet
UserQuietInstCmd=cmd.exe /c setup.cmd -Quiet
$($fileLines -join "`r`n")
[SourceFiles]
SourceFiles0=$stage\
[SourceFiles0]
$($sourceLines -join "`r`n")
"@
$sedPath = Join-Path $stage 'package.sed'
Set-Content -LiteralPath $sedPath -Value $sed -Encoding ASCII

if (Test-Path -LiteralPath $Target) { Remove-Item -LiteralPath $Target -Force }
$proc = Start-Process -FilePath $iexpress -ArgumentList '/N', '/Q', $sedPath -Wait -PassThru -WindowStyle Hidden
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $Target)) { throw "IExpress не собрал пакет (код $($proc.ExitCode))." }
Write-Host "Готово: $Target ($([math]::Round((Get-Item $Target).Length / 1KB)) КБ)"
