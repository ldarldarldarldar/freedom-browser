import React from 'react';
import { Github } from 'lucide-react';
import { useTranslation } from '../i18n';

export const DEVELOPER_GITHUB_URL = 'https://github.com/ldarldarldarldar';

/** "Developer on GitHub" link for About; opens in a new browser tab (main window routes window.open to tabs). */
export const DeveloperLink: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { t } = useTranslation();
  return (
    <a
      id="about-developer-github"
      href={DEVELOPER_GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen?.()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs text-neutral-200 hover:text-white transition-colors"
    >
      <Github className="w-3.5 h-3.5" />
      <span>{t('about.developerGithub')}</span>
      <span className="font-mono text-[11px] text-neutral-500">github.com/ldarldarldarldar</span>
    </a>
  );
};
