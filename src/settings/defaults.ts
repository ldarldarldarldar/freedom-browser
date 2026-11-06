import { BrowserSettings, SearchEngine } from './types';
import { THEME_PRESETS } from './themePresets';

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'startpage',
    name: 'Startpage',
    searchUrl: 'https://www.startpage.com/sp/search?query=%s',
    icon: '🛡️',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q=%s',
    suggestUrl: 'https://duckduckgo.com/ac/?q=%s&type=list',
    icon: '🦆',
  },
  {
    id: 'google',
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=%s',
    suggestUrl: 'https://suggestqueries.google.com/complete/search?client=chrome&q=%s',
    icon: '🔍',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=%s',
    icon: '🦁',
  },
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  // Main Settings
  defaultSearchEngine: 'startpage',
  startpageDefaultApplied: true,
  uiDesignVersion: 2,
  homepage: 'freedom://newtab',
  startupBehavior: 'new-tab',
  newTabBehavior: 'freedom-new-tab',
  downloadsLocation: '~/Downloads',
  askWhereToSaveDownloads: false,
  language: 'en',
  hardwareAcceleration: true,
  smoothScrolling: true,
  restoreTabsAfterRestart: true,
  onCloseWithTabs: 'ask',
  spellcheck: true,

  // Browser Performance Mode (default to Quality with optimizations, toggleable to Performance)
  browserMode: 'quality',

  // Privacy: Default Zero Telemetry & High Privacy
  blockThirdPartyCookies: true,
  doNotTrack: true,
  clearBrowsingDataOnExit: false,
  popupsBlocked: true,
  adBlockEnabled: true,
  checkForUpdates: true,
  httpsOnly: false,
  secureDns: 'off',
  secureDnsCustomUrl: '',

  // Telemetry: Stored strictly locally, OFF by default
  localDiagnosticLogs: false,

  // Visual Customization & Themes
  theme: 'black-space',
  sidebarDock: 'left',
  toolbarDock: 'top',
  downloadSpeedLimitKBps: 0,
  themePreset: 'graphite',
  palette: THEME_PRESETS.graphite,
  backgroundColor: 'black',
  customBackgroundColor: '#0b0e17',
  applyThemeToBackground: true,
  headerColor: 'black',

  // Individual Visual Feature Toggles
  starAnimationEnabled: true,
  backgroundParticlesEnabled: true,
  uiAnimationsEnabled: true,
  blurEffectsEnabled: true,
  starDensity: 'medium',
  animationIntensity: 'subtle',

  // UI Badges
  showNewTabSettingsIcon: true,
  showFreedomIcon: true,

  // Custom Background Image (Stored strictly locally in browser storage)
  customBackgroundImage: null,
  backgroundImageOpacity: 85,
  backgroundImageBlur: 0,
  backgroundImageScale: 'cover',

  // Memory & Performance
  backgroundTabThrottling: true,
};
