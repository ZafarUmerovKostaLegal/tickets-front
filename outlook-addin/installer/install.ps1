<#
  Kosta File for Office — per-user installer (no administrator rights needed).

  * Word / Excel / PowerPoint (Windows desktop): registers the add-in manifest in
    HKCU\Software\Microsoft\Office\16.0\WEF\Developer — after the next start of Office the
    "Kosta File" button is in the ribbon by itself, like a classic DMS add-in.
  * A per-user logon entry quietly re-downloads the manifests, so new buttons and versions
    arrive without reinstalling (the panel itself is a web app and is always current).
  * Outlook add-ins live in the Exchange mailbox and cannot be registered locally. If IT has
    deployed Kosta File for the organisation (admin\Deploy-Outlook.ps1) nothing is needed;
    otherwise the installer offers to add it by hand.
  * Adds "Kosta File for Office" to Apps & features, with an uninstaller.

  -Quiet      no dialogs (logon refresh, mass deployment)
  -Update     only refresh the manifests and registration
  -NoOutlook  skip the Outlook step
  -DryRun     files go to %TEMP%\KostaFileDryRun, registry changes are only logged
#>
[CmdletBinding()]
param(
    [switch]$Quiet,
    [switch]$Update,
    [switch]$NoOutlook,
    [switch]$DryRun,
    [string]$BaseUrl = 'https://tickets.kostalegal.com/outlook-addin/'
)

$ErrorActionPreference = 'Stop'
$AppName = 'Kosta File for Office'
$AppDir = Join-Path $env:LOCALAPPDATA 'Kosta\KostaFile'
if ($DryRun) { $AppDir = Join-Path $env:TEMP 'KostaFileDryRun' }
$ManifestDir = Join-Path $AppDir 'manifests'
$LogFile = Join-Path $AppDir 'install.log'
$OfficeManifest = 'KostaFile.Office.manifest.xml'
$OutlookManifest = 'KostaFile.manifest.xml'
$DeveloperKey = 'HKCU:\Software\Microsoft\Office\16.0\WEF\Developer'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$UninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KostaFileOffice'
$OutlookAddinsPage = 'https://aka.ms/olksideload'

function Write-Log([string]$Message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Message
    Write-Host $line
    if (-not $DryRun) {
        try { Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8 } catch { }
    }
}

function Show-Message([string]$Text, [string]$Kind = 'Information', [string]$Buttons = 'OK') {
    if ($Quiet) { return 'OK' }
    Add-Type -AssemblyName System.Windows.Forms
    return [System.Windows.Forms.MessageBox]::Show($Text, $AppName, $Buttons, $Kind).ToString()
}

function Test-Manifest([string]$Path) {
    try {
        [xml]$xml = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        return [bool]($xml.OfficeApp.Id)
    } catch { return $false }
}

function Get-ManifestInfo([string]$Path) {
    [xml]$xml = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    return @{ Id = [string]$xml.OfficeApp.Id; Version = [string]$xml.OfficeApp.Version }
}

# Newest manifest from the Hub; the copy bundled with the installer when offline.
function Get-Manifest([string]$Name) {
    $target = Join-Path $ManifestDir $Name
    $temp = "$target.download"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $url = ($BaseUrl.TrimEnd('/') + '/manifests/' + $Name)
        Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing -TimeoutSec 20
        if (Test-Manifest $temp) {
            Move-Item -LiteralPath $temp -Destination $target -Force
            Write-Log "Манифест $Name загружен с $url"
            return $target
        }
        Write-Log "С сервера пришёл некорректный $Name — используем копию из установщика"
    } catch {
        Write-Log "Не удалось скачать $Name ($($_.Exception.Message)) — используем копию из установщика"
    } finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
    }
    foreach ($candidate in @((Join-Path $PSScriptRoot $Name), (Join-Path $PSScriptRoot "manifests\$Name"))) {
        if ((Test-Path -LiteralPath $candidate) -and (Test-Manifest $candidate)) {
            if ((Resolve-Path -LiteralPath $candidate).Path -ne $target) {
                Copy-Item -LiteralPath $candidate -Destination $target -Force
            }
            return $target
        }
    }
    if ((Test-Path -LiteralPath $target) -and (Test-Manifest $target)) {
        Write-Log "Оставляем ранее установленный $Name"
        return $target
    }
    throw "Нет манифеста ${Name}: сервер недоступен и в установщике нет копии."
}

function Set-RegistryValue([string]$Key, [string]$Name, [string]$Value) {
    if ($DryRun) { Write-Log "[dry-run] $Key : $Name = $Value"; return }
    if (-not (Test-Path -LiteralPath $Key)) { New-Item -Path $Key -Force | Out-Null }
    New-ItemProperty -LiteralPath $Key -Name $Name -Value $Value -PropertyType String -Force | Out-Null
}

try {
    New-Item -ItemType Directory -Path $ManifestDir -Force | Out-Null
    if (-not $DryRun) {
        # Keep the installer next to the manifests: the logon refresh and the uninstaller run from here.
        foreach ($file in @('install.ps1', 'uninstall.ps1')) {
            $source = Join-Path $PSScriptRoot $file
            $dest = Join-Path $AppDir $file
            if ((Test-Path -LiteralPath $source) -and ($source -ne $dest)) {
                Copy-Item -LiteralPath $source -Destination $dest -Force
            }
        }
    }
    Write-Log "=== ${AppName}: $(if ($Update) { 'обновление' } else { 'установка' }) (пользователь $env:USERNAME) ==="

    # 1. Word / Excel / PowerPoint
    $officePath = Get-Manifest $OfficeManifest
    $office = Get-ManifestInfo $officePath
    Set-RegistryValue $DeveloperKey $office.Id $officePath
    Write-Log "Word, Excel, PowerPoint: надстройка $($office.Id) версии $($office.Version) зарегистрирована"

    # 2. Outlook manifest kept locally for "Add from file" / IT.
    $outlookPath = $null
    try { $outlookPath = Get-Manifest $OutlookManifest } catch { Write-Log $_.Exception.Message }

    # 3. Quiet refresh at every logon.
    $self = Join-Path $AppDir 'install.ps1'
    Set-RegistryValue $RunKey 'KostaFileOffice' ("powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$self`" -Quiet -Update")

    # 4. Apps & features entry.
    if (-not $Update) {
        $uninstall = Join-Path $AppDir 'uninstall.ps1'
        Set-RegistryValue $UninstallKey 'DisplayName' $AppName
        Set-RegistryValue $UninstallKey 'DisplayVersion' $office.Version
        Set-RegistryValue $UninstallKey 'Publisher' 'Kosta Legal'
        Set-RegistryValue $UninstallKey 'InstallLocation' $AppDir
        Set-RegistryValue $UninstallKey 'URLInfoAbout' $BaseUrl
        Set-RegistryValue $UninstallKey 'UninstallString' ("powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstall`"")
        if (-not $DryRun) {
            New-ItemProperty -LiteralPath $UninstallKey -Name 'NoModify' -Value 1 -PropertyType DWord -Force | Out-Null
            New-ItemProperty -LiteralPath $UninstallKey -Name 'NoRepair' -Value 1 -PropertyType DWord -Force | Out-Null
        }
    }

    if ($Update) {
        Write-Log 'Обновление завершено'
        exit 0
    }

    $running = @(Get-Process -Name WINWORD, EXCEL, POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique)
    $restart = if ($running.Count) { "`n`nСейчас открыты: $($running -join ', ') — закройте и снова откройте их." } else { '' }
    Write-Log 'Установка для Word, Excel, PowerPoint завершена'

    if (-not $NoOutlook -and $outlookPath) {
        $answer = Show-Message ("Kosta File установлен в Word, Excel и PowerPoint — кнопка появится на вкладке «Главная» после перезапуска.$restart`n`n" +
            "Outlook: если ИТ уже включил Kosta File для всей компании, кнопка появится сама.`n" +
            "Добавить надстройку в Outlook вручную сейчас? Откроется окно надстроек — выберите «Мои надстройки» → «Добавить из файла» и укажите выделенный файл.") 'Question' 'YesNo'
        if ($answer -eq 'Yes') {
            Start-Process $OutlookAddinsPage
            Start-Process explorer.exe "/select,`"$outlookPath`""
            Write-Log 'Открыто окно надстроек Outlook для ручной установки'
        }
    } else {
        Show-Message "Kosta File установлен в Word, Excel и PowerPoint — кнопка появится на вкладке «Главная» после перезапуска.$restart" | Out-Null
    }
    exit 0
} catch {
    Write-Log "ОШИБКА: $($_.Exception.Message)"
    Show-Message "Не удалось установить Kosta File:`n$($_.Exception.Message)`n`nЖурнал: $LogFile" 'Error' | Out-Null
    exit 1
}
