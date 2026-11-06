export type SearchEngineId = 'startpage' | 'duckduckgo' | 'google' | 'brave' | 'custom';

export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  searchUrl: string; // e.g. "https://duckduckgo.com/?q=%s"
  suggestUrl?: string;
  icon: string;
}

export type BrowserMode = 'performance' | 'quality';

export type BackgroundColorOption = 'black' | 'dark-green' | 'dark-blue' | 'custom';
export type HeaderColorOption = 'black' | 'dark-green' | 'dark-blue' | 'crimson' | 'light' | 'custom';
export type StarDensity = 'low' | 'medium' | 'high';
export type AnimationIntensity = 'subtle' | 'normal' | 'energetic' | 'paused';
export type BackgroundImageScale = 'cover' | 'contain' | 'stretch' | 'center';

export type ThemePresetId =
  | 'graphite'
  | 'midnight'
  | 'forest'
  | 'ocean'
  | 'violet'
  | 'crimson'
  | 'amber'
  | 'monochrome'
  | 'mint'
  | 'midnight-amber'
  | 'arctic-blue'
  | 'custom';

export interface ThemePalette {
  accentColor: string;
  mainBg: string;
  secondaryBg: string;
  sidebarBg: string;
  headerBg: string;
  cardBg: string;
  cardHoverBg: string;
  textColor: string;
  secondaryTextColor: string;
  borderColor: string;
  inputBg: string;
  buttonBg: string;
  buttonHoverBg: string;
  focusColor: string;
  linkColor: string;
  selectionColor: string;
  quickAccessCardBg: string;
  quickAccessIconBg: string;
  scrollbarColor: string;
  particleColor: string;
  glowColor: string;
  shadowIntensity: number; // 0 - 100
}

export type DockEdge = 'top' | 'bottom' | 'left' | 'right';

export type CloseTabsAction = 'ask' | 'save' | 'discard';
export type SecureDnsChoice = 'off' | 'cloudflare' | 'quad9' | 'adguard' | 'mullvad' | 'custom';

export interface BrowserSettings {
  /** Where the left navigation rail and the address toolbar are docked (drag & drop) */
  sidebarDock?: DockEdge;
  toolbarDock?: DockEdge;
  /** Shared cap for all active downloads in KB/s; 0 = unlimited */
  downloadSpeedLimitKBps?: number;
  uiDesignVersion?: number;
  /** Set once the 0.6.5 switch of the default search engine to Startpage has been applied to this profile */
  startpageDefaultApplied?: boolean;
  // Main Settings
  defaultSearchEngine: SearchEngineId;
  customSearchUrl: string;
  homepage: string;
  startupBehavior: 'new-tab' | 'homepage' | 'restore-session';
  openPreviousTabs: boolean;
  newTabBehavior: 'blank' | 'freedom-new-tab' | 'homepage';
  downloadsLocation: string;
  askWhereToSaveDownloads: boolean;
  language: string;
  hardwareAcceleration: boolean;
  smoothScrolling: boolean;
  restoreTabsAfterRestart: boolean;
  /** Closing the browser with open tabs: ask every time, or keep / close them without asking */
  onCloseWithTabs: CloseTabsAction;
  /** Spelling underlines and suggestions in text fields (Russian and English) */
  spellcheck: boolean;

  // Performance Mode (Performance vs Quality)
  browserMode: BrowserMode;

  // Privacy: Default Zero Telemetry & High Privacy
  cookiesEnabled: boolean;
  blockThirdPartyCookies: boolean;
  doNotTrack: boolean;
  clearBrowsingDataOnExit: boolean;
  javascriptEnabled: boolean;
  popupsBlocked: boolean;
  /** Built-in ad & tracker blocker (electron/adblock.cjs) */
  adBlockEnabled: boolean;
  checkForUpdates: boolean;
  /** Top-level http:// pages are opened over https://, with a warning when the site has no https */
  httpsOnly: boolean;
  /** DNS over HTTPS provider, or 'off' for the system resolver */
  secureDns: SecureDnsChoice;
  /** DoH template used when secureDns is 'custom' */
  secureDnsCustomUrl: string;

  // Telemetry & Diagnostics (strictly local, off by default)
  localDiagnosticLogs: boolean;

  // Visual Customization & Toggles
  theme: 'dark' | 'black-space' | 'cyber-mint';
  themePreset: ThemePresetId;
  palette: ThemePalette;

  backgroundColor: BackgroundColorOption;
  customBackgroundColor: string;
  applyThemeToBackground: boolean;
  headerColor: HeaderColorOption;
  customHeaderColor: string;

  // Individual Visual Feature Toggles
  starAnimationEnabled: boolean;
  backgroundParticlesEnabled: boolean;
  uiAnimationsEnabled: boolean;
  blurEffectsEnabled: boolean;
  glowEffectsEnabled: boolean;
  decorativeEffectsEnabled: boolean;
  starDensity: StarDensity;
  animationIntensity: AnimationIntensity;

  // UI Badges
  showNewTabSettingsIcon?: boolean;
  showFreedomIcon?: boolean;

  // Custom Background Image
  customBackgroundImage: string | null;
  backgroundImageOpacity: number; // 0 - 100
  backgroundImageBlur: number; // 0 - 20 (px)
  backgroundImageScale: BackgroundImageScale;

  // Memory & Resource Management
  autoSuspendInactiveTabs: boolean;
  tabSuspensionTimeoutMinutes: number; // e.g. 5 (performance) or 15 (quality)
  backgroundTabThrottling: boolean;
}
