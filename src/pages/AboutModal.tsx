import React from 'react';
import { X, Shield, Code2, Zap, CheckCircle2, Heart, ExternalLink } from 'lucide-react';
import { FreedomLogo } from '../components/FreedomLogo';
import { useTranslation } from '../i18n';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="freedom-about-dialog"
        className="w-full max-w-lg bg-neutral-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FreedomLogo size={22} />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {t('about.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-center">
          <div className="flex flex-col items-center">
            <FreedomLogo size={72} className="mb-3" />
            <h1 className="text-xl font-bold text-white tracking-tight">FREEDOM</h1>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              {t('about.version')}
            </p>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed max-w-md mx-auto">
            {t('about.description')}
          </p>

          {/* Three Core Principles */}
          <div className="grid grid-cols-3 gap-3 pt-2 text-left">
            <div className="p-3 rounded-xl bg-neutral-950/80 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>{t('about.principleFreedom')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleFreedomDesc')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                <Code2 className="w-3.5 h-3.5" />
                <span>{t('about.principleProgramming')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleProgrammingDesc')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{t('about.principleSpeed')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleSpeedDesc')}
              </p>
            </div>
          </div>

          {/* Architecture badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono text-neutral-400">
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-white/5">
              {t('about.engine')}
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-white/5">
              {t('about.runtime')}
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-white/5">
              {t('about.backend')}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              {t('about.zeroTelemetry')}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-950 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-500">
          <span>{t('about.project')}</span>
          <span>{t('about.license')}</span>
        </div>
      </div>
    </div>
  );
};
