import type * as React from 'react';

declare global {
  /** A newer signed release, as reported by electron/updater.cjs */
  interface FreedomUpdateInfo {
    version: string;
    currentVersion: string;
    notes: { ru: string; en: string };
    releaseUrl: string;
    /** install: this copy can update itself. link: zip / tar.gz, only the release page is offered */
    mode: 'install' | 'link';
    size: number;
  }

  /** The certificate a tab's last load was refused for (electron/main.cjs, certificate-error) */
  interface CertificateErrorInfo {
    url: string;
    host: string;
    /** Chromium's name, e.g. net::ERR_CERT_DATE_INVALID */
    error: string;
    subjectName: string;
    issuerName: string;
    /** Seconds since the epoch */
    validStart: number;
    validExpiry: number;
  }

  /** Installed Chrome extension as reported by electron/extensions.cjs */
  interface FreedomExtensionInfo {
    folder: string;
    id: string;
    name: string;
    description: string;
    version: string;
    manifestVersion: number;
    enabled: boolean;
    icon: string | null;
    popup: string | null;
    options: string | null;
    error: string | null;
  }
}

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
      homeDir?: string;
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
      setDownloadSpeedLimit?: (kbps: number) => Promise<number>;
      certificateError?: {
        info: (webContentsId: number, url: string) => Promise<CertificateErrorInfo | null>;
        allow: (webContentsId: number, url: string) => Promise<boolean>;
      };
      sitePermissions?: {
        list: () => Promise<Array<{ origin: string; permission: string; decision: 'allow' | 'block' }>>;
        remove: (origin: string, permission: string) => Promise<boolean>;
      };
      updates?: {
        check: () => Promise<{ status: 'none' | 'error'; currentVersion: string } | { status: 'available'; update: FreedomUpdateInfo }>;
        download: () => Promise<{ ok: boolean; error?: string }>;
        cancel: () => Promise<void>;
        install: () => Promise<{ ok: boolean; error?: string }>;
        skip: () => Promise<void>;
      };
      extensions?: {
        list: () => Promise<FreedomExtensionInfo[]>;
        installFolder: () => Promise<string | null>;
        installFile: () => Promise<string | null>;
        installFromStore: (idOrUrl: string) => Promise<string>;
        setEnabled: (folder: string, enabled: boolean) => Promise<void>;
        remove: (folder: string) => Promise<void>;
        open: (folder: string, kind: 'popup' | 'options', anchor?: { x: number; y: number }) => Promise<boolean>;
      };
      setPrivacySettings?: (settings: { doNotTrack: boolean; blockThirdPartyCookies: boolean; popupsBlocked: boolean; adBlockEnabled: boolean; checkForUpdates?: boolean }) => Promise<unknown>;
      getHardwareAcceleration?: () => Promise<boolean>;
      setHardwareAcceleration?: (enabled: boolean) => Promise<boolean>;
      /** null = automatic (Chromium decides). Takes effect after a restart. */
      getRendererProcessLimit?: () => Promise<number | null>;
      setRendererProcessLimit?: (limit: number | null) => Promise<boolean>;
      relaunchApp?: () => Promise<void>;
      getUserDataPath?: () => Promise<string>;
      chooseUserDataPath?: () => Promise<string | null>;
      migrateUserDataPath?: (options: { targetPath?: string; migrateExisting: boolean; reset?: boolean }) => Promise<{ success: boolean; newPath?: string; pending?: boolean; error?: string }>;
      getUserDataInfo?: () => Promise<{
        path: string;
        defaultPath: string;
        isDefault: boolean;
        pendingPath: string | null;
        lastError: string | null;
        sizeBytes: number;
        cacheBytes: number;
      }>;
      cancelUserDataMove?: () => Promise<boolean>;
      openUserDataFolder?: () => Promise<string>;
      toggleFullScreen?: () => Promise<boolean>;
      setFullScreen?: (flag: boolean) => Promise<boolean>;
      isFullScreen?: () => Promise<boolean>;
      forceCloseApp?: () => Promise<void>;
    };
  }
}

export {};
