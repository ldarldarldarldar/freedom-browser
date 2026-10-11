import React from 'react';
import {
  Columns2,
  Rows2,
  Columns3,
  Columns4,
  Grid2x2,
  LayoutGrid,
  Plus,
  RotateCcw,
  X,
  Minimize2,
} from 'lucide-react';
import { SplitLayoutType, SplitViewState, SplitViewService } from '../services/splitViewService';
import { useTranslation } from '../i18n';

interface SplitViewControlBarProps {
  splitViewState: SplitViewState;
  onSelectLayout: (layout: SplitLayoutType) => void;
  onAddPane: () => void;
  onResetDividers: () => void;
  onExitSplitView: () => void;
}

export const SplitViewControlBar: React.FC<SplitViewControlBarProps> = ({
  splitViewState,
  onSelectLayout,
  onAddPane,
  onResetDividers,
  onExitSplitView,
}) => {
  const { t } = useTranslation();
  const paneCount = splitViewState.panes.length;
  const currentLayout = splitViewState.layout;

  // Available layout options for current count
  const renderLayoutOptions = () => {
    if (paneCount <= 2) {
      return (
        <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
          <button
            type="button"
            onClick={() => onSelectLayout('2-vertical')}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              currentLayout === '2-vertical'
                ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('split.layout2Vertical')}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{t('split.vertical')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLayout('2-horizontal')}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              currentLayout === '2-horizontal'
                ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('split.layout2Horizontal')}
          >
            <Rows2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{t('split.horizontal')}</span>
          </button>
        </div>
      );
    }

    if (paneCount === 3) {
      return (
        <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
          <button
            type="button"
            onClick={() => onSelectLayout('3-left-main')}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              currentLayout === '3-left-main'
                ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('split.layout3LeftMain')}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{t('split.leftMain')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLayout('3-top-main')}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              currentLayout === '3-top-main'
                ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('split.layout3TopMain')}
          >
            <Rows2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{t('split.topMain')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectLayout('3-columns')}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              currentLayout === '3-columns'
                ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
            title={t('split.layout3Columns')}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{t('split.3columns')}</span>
          </button>
        </div>
      );
    }

    // 4 Panes
    return (
      <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/[0.08]">
        <button
          type="button"
          onClick={() => onSelectLayout('4-grid')}
          className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
            currentLayout === '4-grid'
              ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title={t('split.layout4Grid')}
        >
          <Grid2x2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">{t('split.grid2x2')}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectLayout('4-columns')}
          className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
            currentLayout === '4-columns'
              ? 'bg-white/[0.08] text-white font-medium border border-white/10 shadow-xs'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
          title={t('split.layout4Columns')}
        >
          <Columns4 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">{t('split.4columns')}</span>
        </button>
      </div>
    );
  };

  return (
    <div
      id="freedom-split-view-control-bar"
      className="h-8.5 w-full bg-[#0d0f16]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between px-3.5 select-none z-30 shrink-0 text-xs text-neutral-300"
    >
      {/* Left side: Layout presets */}
      <div className="flex items-center gap-2">
        {renderLayoutOptions()}
      </div>

      {/* Right side: Add pane, Reset dividers, Exit */}
      <div className="flex items-center gap-1.5">
        {/* Add Pane action */}
        {paneCount < 4 && (
          <button
            type="button"
            onClick={onAddPane}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors text-xs font-semibold cursor-pointer"
            title={t('split.addPaneTooltip')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('split.addPane')}</span>
          </button>
        )}

        {/* Reset Proportions */}
        <button
          type="button"
          onClick={onResetDividers}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          title={t('split.resetLayout')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Exit Split View */}
        <button
          type="button"
          onClick={onExitSplitView}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title={t('split.exitSplit')}
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
