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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="freedom-about-dialog"
        className="w-full max-w-lg bg-[#12141c]/98 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-neutral-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0d0f15] border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <FreedomLogo size={22} />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {t('about.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-center">
          <div className="flex flex-col items-center">
            <FreedomLogo size={72} className="mb-3" />
            <h1 className="text-2xl font-bold text-white tracking-tight">FREEDOM</h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              {t('about.version')}
            </p>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed max-w-md mx-auto">
            {t('about.description')}
          </p>

          {/* Three Core Principles */}
          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/15 transition-all">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>{t('about.principleFreedom')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleFreedomDesc')}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/15 transition-all">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>{t('about.principleProgramming')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleProgrammingDesc')}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/15 transition-all">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>{t('about.principleSpeed')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {t('about.principleSpeedDesc')}
              </p>
            </div>
          </div>

          {/* Architecture badges */}
          <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-neutral-400">
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              {t('about.engine')}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              {t('about.runtime')}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              {t('about.backend')}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              {t('about.zeroTelemetry')}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0d0f15] border-t border-white/[0.08] flex items-center justify-between text-xs text-neutral-500">
          <span>{t('about.project')}</span>
          <span>{t('about.license')}</span>
        </div>
      </div>
    </div>
  );
};
