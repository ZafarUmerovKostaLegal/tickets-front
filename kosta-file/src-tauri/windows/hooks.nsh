; Kosta File installer: the same setup also adds the Kosta File add-in to Word, Excel and PowerPoint
; (per user, no admin rights). Uninstalling Kosta File removes the add-in registration too.

!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\office\install.ps1" -Quiet -NoOutlook'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\office\uninstall.ps1" -Quiet'
!macroend
