import React from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Home,
  ShieldAlert,
  WifiOff,
  Search,
  ServerCrash,
} from 'lucide-react';

interface ErrorPageProps {
  errorType: 'dns' | 'offline' | 'certificate' | 'crashed' | 'invalid_url' | 'blocked';
  url: string;
  errorMessage?: string;
  onReload: () => void;
  onHome: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  errorType,
  url,
  errorMessage,
  onReload,
  onHome,
}) => {
  const getErrorDetails = () => {
    switch (errorType) {
      case 'offline':
        return {
          icon: <WifiOff className="w-12 h-12 text-amber-400" />,
          title: 'No Internet Connection',
          desc: 'Freedom Browser could not connect to the network. Check your internet connection, Wi-Fi, or firewall settings.',
          code: 'ERR_INTERNET_DISCONNECTED',
        };
      case 'certificate':
        return {
          icon: <ShieldAlert className="w-12 h-12 text-red-400" />,
          title: 'Security Certificate Warning',
          desc: 'The TLS certificate presented by this server is invalid, expired, or self-signed. Freedom blocks connections to protect your privacy.',
          code: 'ERR_CERT_AUTHORITY_INVALID',
        };
      case 'crashed':
        return {
          icon: <ServerCrash className="w-12 h-12 text-red-400" />,
          title: 'This Page Crashed',
          desc: 'The isolated tab rendering process ran out of memory or encountered a fatal exception. Other tabs in Freedom remain unaffected.',
          code: 'ERR_RENDERER_PROCESS_TERMINATED',
        };
      case 'invalid_url':
        return {
          icon: <AlertTriangle className="w-12 h-12 text-amber-400" />,
          title: 'Invalid Web Address',
          desc: 'The address you entered does not match a valid web domain or Freedom internal protocol.',
          code: 'ERR_NAME_NOT_RESOLVED',
        };
      case 'dns':
      default:
        return {
          icon: <AlertTriangle className="w-12 h-12 text-neutral-400" />,
          title: 'Server Not Found (DNS Failure)',
          desc: 'Freedom could not resolve the host IP address. Check for spelling errors or DNS configuration.',
          code: 'ERR_NAME_RESOLUTION_FAILED',
        };
    }
  };

  const details = getErrorDetails();

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center select-none bg-neutral-950/90 text-neutral-200">
      <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 mb-5">
        {details.icon}
      </div>

      <h2 className="text-xl font-bold text-white mb-2">{details.title}</h2>

      <p className="text-xs text-neutral-400 max-w-md mb-2 leading-relaxed">
        {details.desc}
      </p>

      {errorMessage && (
        <div className="p-2 rounded bg-neutral-900 border border-white/5 font-mono text-[11px] text-red-300 max-w-md mb-4 break-all">
          {errorMessage}
        </div>
      )}

      <div className="text-[10px] font-mono text-neutral-500 mb-6 bg-neutral-900/60 px-2.5 py-1 rounded">
        URL: {url} • Error Code: {details.code}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>

        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Freedom Home</span>
        </button>
      </div>
    </div>
  );
};
