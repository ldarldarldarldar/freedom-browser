export type SearchEngineId = 'duckduckgo' | 'google' | 'bing' | 'brave' | 'ecosia' | 'custom';

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
  | 'midnight'
  | 'forest'
  | 'ocean'
  | 'violet'
  | 'crimson'
  | 'amber'
  | 'monochrome'
  | 'mint'
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

export interface BrowserSettings {
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

  // Performance Mode (Performance vs Quality)
  browserMode: BrowserMode;

  // Privacy: Default Zero Telemetry & High Privacy
  cookiesEnabled: boolean;
  blockThirdPartyCookies: boolean;
  doNotTrack: boolean;
  clearBrowsingDataOnExit: boolean;
  javascriptEnabled: boolean;
  popupsBlocked: boolean;

  // Telemetry & Diagnostics (strictly local, off by default)
  localDiagnosticLogs: boolean;

  // Visual Customization & Toggles
  theme: 'dark' | 'black-space' | 'cyber-mint';
  themePreset: ThemePresetId;
  palette: ThemePalette;

  backgroundColor: BackgroundColorOption;
  customBackgroundColor: string;
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

  // Mascot
  showFreenMascot: boolean;

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
