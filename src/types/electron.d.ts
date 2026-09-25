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
      openDownloadFolder: (folder?: string) => Promise<boolean>;
      startDownload: (options: { url: string; suggestedFilename?: string }) => Promise<boolean>;
      setTitle: (title: string) => Promise<void>;
      closeApp: () => Promise<void>;
      pickCustomBackground: () => Promise<string | null>;
      setBrowserMode: (mode: 'performance' | 'quality') => Promise<boolean>;
    };
  }
}

export {};
