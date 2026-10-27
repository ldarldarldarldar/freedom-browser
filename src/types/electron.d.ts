import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          autosize?: string;
          nodeintegration?: string;
          plugins?: string;
          preload?: string;
          httpreferrer?: string;
          useragent?: string;
          disablewebsecurity?: string;
          partition?: string;
          allowpopups?: string;
          allowfullscreen?: string;
          webpreferences?: string;
          enableblinkfeatures?: string;
          disableblinkfeatures?: string;
        },
        HTMLElement
      >;
    }
  }
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, listener: (...args: any[]) => void) => () => void;
      getSystemMetrics: () => Promise<any>;
      terminateProcess: (pid: number) => Promise<boolean>;
      openDevTools: () => Promise<boolean>;
      openDownloadFolder?: (folder?: string) => Promise<boolean>;
      getDefaultDownloadDir?: () => Promise<string>;
      setDownloadsDir?: (dir: string) => Promise<boolean>;
      chooseDownloadDir?: () => Promise<string | null>;
      setLanguage?: (lang: string) => Promise<boolean>;
      startDownload: (options: { url: string; suggestedFilename?: string }) => Promise<boolean>;
      setTitle: (title: string) => Promise<void>;
      closeApp: () => Promise<void>;
      pickCustomBackground: () => Promise<string | null>;
      setBrowserMode: (mode: 'performance' | 'quality') => Promise<boolean>;
      setPrivacySettings?: (settings: { doNotTrack: boolean; blockThirdPartyCookies: boolean; popupsBlocked: boolean }) => Promise<unknown>;
      getHardwareAcceleration?: () => Promise<boolean>;
      setHardwareAcceleration?: (enabled: boolean) => Promise<boolean>;
      relaunchApp?: () => Promise<void>;
      getUserDataPath?: () => Promise<string>;
      chooseUserDataPath?: () => Promise<string | null>;
      migrateUserDataPath?: (options: { targetPath: string; migrateExisting: boolean }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
      toggleFullScreen?: () => Promise<boolean>;
      setFullScreen?: (flag: boolean) => Promise<boolean>;
      isFullScreen?: () => Promise<boolean>;
      forceCloseApp?: () => Promise<void>;
    };
  }
}

export {};
