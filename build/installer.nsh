; Freedom Browser - NSIS installer additions (electron-builder "nsis.include")
; Registers the browser with Windows so it shows up in Settings → Apps → Default apps,
; the "Open with" list for web pages and as a handler for http/https links.
; SHCTX is HKLM for the per-machine install (HKCU for a per-user one).

!define FB_CLIENT "Software\Clients\StartMenuInternet\Freedom Browser"
!define FB_EXE "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!define FB_LINK "Freedom Browser.lnk"

; ---- "Additional options" page (after the folder page): shortcuts, autostart, default browser ----
; Silent installs use the defaults, changeable with /NODESKTOP /NOSTARTMENU /STARTUP.
; Taskbar pinning is not offered: Windows 10/11 have no supported way for installers to pin.
!ifndef BUILD_UNINSTALLER
  !include MUI2.nsh
  !include nsDialogs.nsh
  !include LogicLib.nsh
  !include FileFunc.nsh

  Var FBDesktop
  Var FBStartMenu
  Var FBStartup
  Var FBDefaultApps
  Var FBDesktopBox
  Var FBStartMenuBox
  Var FBStartupBox
  Var FBDefaultAppsBox

  !macro FB_TEXT VAR EN RU
    ${If} $LANGUAGE == 1049
      StrCpy ${VAR} "${RU}"
    ${Else}
      StrCpy ${VAR} "${EN}"
    ${EndIf}
  !macroend

  Function FBOptionsPage
    !insertmacro FB_TEXT $R1 "Additional options" "Дополнительные параметры"
    !insertmacro FB_TEXT $R2 "Choose shortcuts and how Freedom Browser starts." "Выберите ярлыки и параметры запуска Freedom Browser."
    !insertmacro MUI_HEADER_TEXT $R1 $R2
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    !insertmacro FB_TEXT $R1 "Create a desktop shortcut" "Создать ярлык на рабочем столе"
    ${NSD_CreateCheckbox} 0 0u 100% 12u $R1
    Pop $FBDesktopBox
    ${NSD_SetState} $FBDesktopBox $FBDesktop

    !insertmacro FB_TEXT $R1 "Create a Start menu shortcut" "Создать ярлык в меню «Пуск»"
    ${NSD_CreateCheckbox} 0 18u 100% 12u $R1
    Pop $FBStartMenuBox
    ${NSD_SetState} $FBStartMenuBox $FBStartMenu

    !insertmacro FB_TEXT $R1 "Start Freedom Browser when Windows starts" "Запускать Freedom Browser вместе с Windows"
    ${NSD_CreateCheckbox} 0 36u 100% 12u $R1
    Pop $FBStartupBox
    ${NSD_SetState} $FBStartupBox $FBStartup

    !insertmacro FB_TEXT $R1 "Open Windows settings to make Freedom the default browser" "Открыть настройки Windows, чтобы сделать Freedom браузером по умолчанию"
    ${NSD_CreateCheckbox} 0 54u 100% 12u $R1
    Pop $FBDefaultAppsBox
    ${NSD_SetState} $FBDefaultAppsBox $FBDefaultApps

    !insertmacro FB_TEXT $R1 "To pin Freedom to the taskbar, right-click its icon after launch and choose Pin to taskbar (Windows does not let installers do it)." "Чтобы закрепить Freedom на панели задач, после запуска нажмите на значок правой кнопкой → «Закрепить на панели задач» (Windows не разрешает установщикам делать это самим)."
    ${NSD_CreateLabel} 0 80u 100% 30u $R1
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function FBOptionsLeave
    ${NSD_GetState} $FBDesktopBox $FBDesktop
    ${NSD_GetState} $FBStartMenuBox $FBStartMenu
    ${NSD_GetState} $FBStartupBox $FBStartup
    ${NSD_GetState} $FBDefaultAppsBox $FBDefaultApps
  FunctionEnd
!endif

!macro customInit
  StrCpy $FBDesktop ${BST_CHECKED}
  StrCpy $FBStartMenu ${BST_CHECKED}
  StrCpy $FBStartup ${BST_UNCHECKED}
  StrCpy $FBDefaultApps ${BST_UNCHECKED}
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/NODESKTOP" $R1
  ${IfNot} ${Errors}
    StrCpy $FBDesktop ${BST_UNCHECKED}
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/NOSTARTMENU" $R1
  ${IfNot} ${Errors}
    StrCpy $FBStartMenu ${BST_UNCHECKED}
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/STARTUP" $R1
  ${IfNot} ${Errors}
    StrCpy $FBStartup ${BST_CHECKED}
  ${EndIf}
  ClearErrors
!macroend

!macro customPageAfterChangeDir
  Page custom FBOptionsPage FBOptionsLeave
!macroend

!macro customInstall
  ; Shortcuts chosen on the options page (all users for the per-machine install)
  Delete "$DESKTOP\${FB_LINK}"
  Delete "$SMPROGRAMS\${FB_LINK}"
  Delete "$SMSTARTUP\${FB_LINK}"
  ${If} $FBDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${FB_LINK}" "${FB_EXE}" "" "${FB_EXE}" 0
    WinShell::SetLnkAUMI "$DESKTOP\${FB_LINK}" "${APP_ID}"
  ${EndIf}
  ${If} $FBStartMenu == ${BST_CHECKED}
    CreateShortCut "$SMPROGRAMS\${FB_LINK}" "${FB_EXE}" "" "${FB_EXE}" 0
    WinShell::SetLnkAUMI "$SMPROGRAMS\${FB_LINK}" "${APP_ID}"
  ${EndIf}
  ${If} $FBStartup == ${BST_CHECKED}
    CreateShortCut "$SMSTARTUP\${FB_LINK}" "${FB_EXE}" "" "${FB_EXE}" 0
  ${EndIf}

  ; URL handler (http/https) and HTML document ProgIDs
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserURL" "" "Freedom Browser URL"
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserURL" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserURL" "FriendlyTypeName" "Freedom Browser URL"
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserURL\DefaultIcon" "" "${FB_EXE},0"
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserURL\shell\open\command" "" '"${FB_EXE}" "%1"'

  WriteRegStr SHCTX "Software\Classes\FreedomBrowserHTML" "" "Freedom Browser HTML Document"
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserHTML\DefaultIcon" "" "${FB_EXE},0"
  WriteRegStr SHCTX "Software\Classes\FreedomBrowserHTML\shell\open\command" "" '"${FB_EXE}" "%1"'

  ; Start menu internet client + capabilities (Default apps)
  WriteRegStr SHCTX "${FB_CLIENT}" "" "Freedom Browser"
  WriteRegStr SHCTX "${FB_CLIENT}\DefaultIcon" "" "${FB_EXE},0"
  WriteRegStr SHCTX "${FB_CLIENT}\shell\open\command" "" '"${FB_EXE}"'
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities" "ApplicationName" "Freedom Browser"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities" "ApplicationDescription" "Lightweight, fast, and privacy-focused web browser"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities" "ApplicationIcon" "${FB_EXE},0"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\StartMenu" "StartMenuInternet" "Freedom Browser"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\URLAssociations" "http" "FreedomBrowserURL"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\URLAssociations" "https" "FreedomBrowserURL"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\FileAssociations" ".html" "FreedomBrowserHTML"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\FileAssociations" ".htm" "FreedomBrowserHTML"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\FileAssociations" ".shtml" "FreedomBrowserHTML"
  WriteRegStr SHCTX "${FB_CLIENT}\Capabilities\FileAssociations" ".xhtml" "FreedomBrowserHTML"
  WriteRegStr SHCTX "Software\RegisteredApplications" "Freedom Browser" "${FB_CLIENT}\Capabilities"

  ; "Open with" list for web pages
  WriteRegStr SHCTX "Software\Classes\.html\OpenWithProgids" "FreedomBrowserHTML" ""
  WriteRegStr SHCTX "Software\Classes\.htm\OpenWithProgids" "FreedomBrowserHTML" ""

  ; App Paths: Win+R → "freedom-browser"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}" "" "${FB_EXE}"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}" "Path" "$INSTDIR"

  ; Tell Explorer that associations changed
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  ${If} $FBDefaultApps == ${BST_CHECKED}
  ${AndIfNot} ${Silent}
    ExecShell "open" "ms-settings:defaultapps?registeredAppMachine=Freedom Browser"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$DESKTOP\${FB_LINK}"
  Delete "$SMPROGRAMS\${FB_LINK}"
  Delete "$SMSTARTUP\${FB_LINK}"
  DeleteRegKey SHCTX "Software\Classes\FreedomBrowserURL"
  DeleteRegKey SHCTX "Software\Classes\FreedomBrowserHTML"
  DeleteRegKey SHCTX "${FB_CLIENT}"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Freedom Browser"
  DeleteRegValue SHCTX "Software\Classes\.html\OpenWithProgids" "FreedomBrowserHTML"
  DeleteRegValue SHCTX "Software\Classes\.htm\OpenWithProgids" "FreedomBrowserHTML"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
