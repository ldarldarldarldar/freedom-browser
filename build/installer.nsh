; Freedom Browser - NSIS installer additions (electron-builder "nsis.include")
; Registers the browser with Windows so it shows up in Settings → Apps → Default apps,
; the "Open with" list for web pages and as a handler for http/https links.
; SHCTX is HKLM for the per-machine install (HKCU for a per-user one).

!define FB_CLIENT "Software\Clients\StartMenuInternet\Freedom Browser"
!define FB_EXE "$INSTDIR\${APP_EXECUTABLE_FILENAME}"

!macro customInstall
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
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\FreedomBrowserURL"
  DeleteRegKey SHCTX "Software\Classes\FreedomBrowserHTML"
  DeleteRegKey SHCTX "${FB_CLIENT}"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "Freedom Browser"
  DeleteRegValue SHCTX "Software\Classes\.html\OpenWithProgids" "FreedomBrowserHTML"
  DeleteRegValue SHCTX "Software\Classes\.htm\OpenWithProgids" "FreedomBrowserHTML"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\App Paths\${APP_EXECUTABLE_FILENAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
