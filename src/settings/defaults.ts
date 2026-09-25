import { BrowserSettings, SearchEngine } from './types';
import { THEME_PRESETS } from './themePresets';

export const SEARCH_ENGINES: SearchEngine[] = [
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
    id: 'bing',
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=%s',
    icon: '🌐',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=%s',
    icon: '🦁',
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    searchUrl: 'https://www.ecosia.org/search?q=%s',
    icon: '🌲',
  },
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  // Main Settings
  defaultSearchEngine: 'duckduckgo',
  customSearchUrl: '',
  homepage: 'freedom://newtab',
  startupBehavior: 'new-tab',
  openPreviousTabs: true,
  newTabBehavior: 'freedom-new-tab',
  downloadsLocation: '~/Downloads',
  askWhereToSaveDownloads: false,
  language: 'en-US',
  hardwareAcceleration: true,
  smoothScrolling: true,
  restoreTabsAfterRestart: true,

  // Browser Performance Mode (default to Quality with optimizations, toggleable to Performance)
  browserMode: 'quality',

  // Privacy: Default Zero Telemetry & High Privacy
  cookiesEnabled: true,
  blockThirdPartyCookies: true,
  doNotTrack: true,
  clearBrowsingDataOnExit: false,
  javascriptEnabled: true,
  popupsBlocked: true,

  // Telemetry: Stored strictly locally, OFF by default
  localDiagnosticLogs: false,

  // Visual Customization & Themes
  theme: 'black-space',
  themePreset: 'midnight',
  palette: THEME_PRESETS.midnight,
  backgroundColor: 'black',
  customBackgroundColor: '#06080b',
  headerColor: 'black',
  customHeaderColor: '#0a0d12',

  // Individual Visual Feature Toggles
  starAnimationEnabled: true,
  backgroundParticlesEnabled: true,
  uiAnimationsEnabled: true,
  blurEffectsEnabled: true,
  glowEffectsEnabled: true,
  decorativeEffectsEnabled: true,
  starDensity: 'medium',
  animationIntensity: 'subtle',

  // Mascot
  showFreenMascot: true,

  // Custom Background Image (Stored strictly locally in browser storage)
  customBackgroundImage: null,
  backgroundImageOpacity: 85,
  backgroundImageBlur: 0,
  backgroundImageScale: 'cover',

  // Memory & Performance
  autoSuspendInactiveTabs: true,
  tabSuspensionTimeoutMinutes: 15,
  backgroundTabThrottling: true,
};
