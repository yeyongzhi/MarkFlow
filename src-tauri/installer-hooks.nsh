; MarkFlow keeps settings, history versions and backups in <install directory>\data.
; The uninstaller only removes that folder when the user ticks the "delete app data" checkbox,
; so a plain uninstall or reinstall keeps the workspace registry, favourites and version history.
!include LogicLib.nsh

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $DeleteAppDataCheckboxState = 1
    RmDir /r "$INSTDIR\data"
  ${EndIf}
!macroend
