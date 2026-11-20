<#
  Kosta File — one-time Outlook deployment for the whole organisation (run by an Exchange admin).

  Outlook add-ins live in the Exchange mailbox, so a local installer cannot add them. Deployed as an
  organisation app, Kosta File appears by itself in classic Outlook, new Outlook, Outlook on the web
  and Outlook for Mac for every user — no action from employees. The manifest is taken by URL,
  so Exchange picks up new versions from the Hub automatically.

  Usage (PowerShell 7 or Windows PowerShell 5.1):
    .\Deploy-Outlook.ps1                     # everyone, enabled by default
    .\Deploy-Outlook.ps1 -Remove             # take it back
  Same can be done in the UI: Microsoft 365 admin center → Settings → Integrated apps →
  Upload custom apps → "Provide link to manifest file".
#>
[CmdletBinding()]
param(
    [string]$ManifestUrl = 'https://tickets.kostalegal.com/outlook-addin/manifests/KostaFile.manifest.xml',
    [string]$AppId = '8f3c2a1e-6b4d-4e9a-9c71-a1b2c3d4e5f6',
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
    Write-Host 'Устанавливаем модуль ExchangeOnlineManagement для текущего пользователя…'
    Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force
}
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -ShowBanner:$false

try {
    $existing = Get-App -OrganizationApp -Identity $AppId -ErrorAction SilentlyContinue
    if ($Remove) {
        if ($existing) {
            Remove-App -OrganizationApp -Identity $AppId -Confirm:$false
            Write-Host 'Kosta File удалён из Outlook организации.'
        } else {
            Write-Host 'Kosta File не был развёрнут для организации.'
        }
        return
    }
    if ($existing) {
        # Re-reading the manifest by URL brings the new version to every mailbox.
        Remove-App -OrganizationApp -Identity $AppId -Confirm:$false
    }
    New-App -OrganizationApp -Url $ManifestUrl -ProvidedTo Everyone -DefaultStateForUser Enabled | Out-Null
    Write-Host "Kosta File развёрнут в Outlook для всей организации ($ManifestUrl)."
    Write-Host 'У сотрудников кнопка появится в течение нескольких часов (обычно быстрее после перезапуска Outlook).'
} finally {
    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
}
