import React from 'react';
import {
  AlertTriangle,
  Ban,
  Eye,
  Hourglass,
  Home,
  Lock,
  RotateCcw,
  ServerCrash,
  ShieldAlert,
  Unplug,
  WifiOff,
  MapPinOff,
  FileQuestion,
  Hand,
  Gauge,
  Coffee,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { TranslationKey } from '../i18n/translations';
import { LoadErrorType } from '../browser/loadErrors';

interface ErrorPageProps {
  errorType: LoadErrorType;
  url: string;
  /** Chromium's error name or the HTTP status line */
  code?: string;
  httpStatus?: number;
  errorMessage?: string;
  onReload: () => void;
  onHome: () => void;
  /** The server did send something: let the user see it instead of this screen */
  onShowResponse?: () => void;
}

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;

interface ErrorCopy {
  icon: IconType;
  title: TranslationKey;
  desc: TranslationKey;
}

const COPY: Record<Exclude<LoadErrorType, 'http'>, ErrorCopy> = {
  dns: { icon: MapPinOff, title: 'error.dnsTitle', desc: 'error.dnsDesc' },
  offline: { icon: WifiOff, title: 'error.offlineTitle', desc: 'error.offlineDesc' },
  refused: { icon: Lock, title: 'error.refusedTitle', desc: 'error.refusedDesc' },
  timeout: { icon: Hourglass, title: 'error.timeoutTitle', desc: 'error.timeoutDesc' },
  reset: { icon: Unplug, title: 'error.resetTitle', desc: 'error.resetDesc' },
  certificate: { icon: ShieldAlert, title: 'error.certTitle', desc: 'error.certDesc' },
  blocked: { icon: Ban, title: 'error.blockedTitle', desc: 'error.blockedDesc' },
  invalid_url: { icon: AlertTriangle, title: 'error.invalidUrlTitle', desc: 'error.invalidUrlDesc' },
  crashed: { icon: ServerCrash, title: 'error.crashedTitle', desc: 'error.crashedDesc' },
  generic: { icon: AlertTriangle, title: 'error.genericTitle', desc: 'error.genericDesc' },
};

const httpCopy = (status = 0): ErrorCopy => {
  if (status === 404 || status === 410) return { icon: FileQuestion, title: 'error.http404Title', desc: 'error.http404Desc' };
  if (status === 401 || status === 403) return { icon: Hand, title: 'error.http403Title', desc: 'error.http403Desc' };
  if (status === 429) return { icon: Gauge, title: 'error.http429Title', desc: 'error.http429Desc' };
  if (status === 502 || status === 503 || status === 504) return { icon: Coffee, title: 'error.http503Title', desc: 'error.http503Desc' };
  if (status >= 500) return { icon: ServerCrash, title: 'error.http500Title', desc: 'error.http500Desc' };
  return { icon: AlertTriangle, title: 'error.http4xxTitle', desc: 'error.http4xxDesc' };
};

export const ErrorPage: React.FC<ErrorPageProps> = ({
  errorType,
  url,
  code,
  httpStatus,
  errorMessage,
  onReload,
  onHome,
  onShowResponse,
}) => {
  const { t } = useTranslation();
  const { icon: Icon, title, desc } = errorType === 'http' ? httpCopy(httpStatus) : COPY[errorType];

  return (
    <div
      id="freedom-error-page"
      data-error-type={errorType}
      className="relative flex flex-col items-center justify-center h-full px-6 text-center select-none overflow-y-auto no-scrollbar bg-[var(--fb-bg)] text-[var(--fb-text)]"
    >
      {httpStatus ? (
        <div aria-hidden="true" className="text-[clamp(72px,14vw,132px)] font-light leading-none tracking-tight tabular-nums text-[var(--fb-accent-soft)] mb-5">
          {httpStatus}
        </div>
      ) : (
        <div className="p-4 rounded-[var(--fb-radius-xl)] border border-[var(--fb-border)] bg-[var(--fb-surface)] mb-6">
          <Icon className="w-10 h-10 text-[var(--fb-accent-soft)]" strokeWidth={1.25} />
        </div>
      )}

      <h2 className="text-[22px] font-normal tracking-tight mb-2.5">{t(title)}</h2>

      <p className="text-[13px] text-[var(--fb-text-2)] max-w-[480px] mb-5 leading-relaxed">{t(desc)}</p>

      {errorMessage && (
        <p className="text-[12px] text-[var(--fb-text-2)] max-w-[480px] mb-5 break-words">{errorMessage}</p>
      )}

      <div className="flex items-center gap-2.5 mb-6">
        <button
          type="button"
          id="error-try-again"
          onClick={onReload}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--fb-radius-md)] bg-[var(--fb-accent)] text-[var(--fb-on-accent)] text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('error.tryAgain')}</span>
        </button>
        <button
          type="button"
          id="error-home"
          onClick={onHome}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--fb-radius-md)] border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-surface-hover)] text-xs transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>{t('error.home')}</span>
        </button>
        {onShowResponse && (
          <button
            type="button"
            id="error-show-response"
            onClick={onShowResponse}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--fb-radius-md)] border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-surface-hover)] text-xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t('error.showResponse')}</span>
          </button>
        )}
      </div>

      <div className="max-w-[560px] select-text text-[11px] font-mono text-[var(--fb-text-3)] break-all">
        {url}
        {code && <span className="block mt-1">{code}</span>}
      </div>
    </div>
  );
};
