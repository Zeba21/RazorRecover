import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { SHAPInfo } from '../../services/dashboardApi';
import { formatFeatureName, stripModuleText } from '../../utils/formatters';

interface SHAPFactorsProps {
  shapInfo: SHAPInfo;
}

export const SHAPFactors: React.FC<SHAPFactorsProps> = ({ shapInfo }) => {
  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-surface-100">SHAP Model Explainability</h3>
        </div>
        <span className="text-[11px] text-surface-200/40 uppercase font-mono font-semibold">
          {stripModuleText('Module 5 SHAP Attribution')}
        </span>
      </div>

      {/* Human Narrative */}
      <div className="p-3.5 mb-5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">{stripModuleText(shapInfo.human_explanation)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Positive Factors */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Positive Recovery Drivers
          </div>
          <div className="space-y-2">
            {shapInfo.top_positive_factors.length === 0 ? (
              <p className="text-xs text-surface-200/40 italic">No significant positive factors.</p>
            ) : (
              shapInfo.top_positive_factors.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-surface-100 font-mono text-[11px]">{formatFeatureName(item.feature)}</span>
                    <span className="font-extrabold text-emerald-400 font-mono">{item.importance}</span>
                  </div>
                  <p className="text-[11px] text-surface-200/70 mt-1">{stripModuleText(item.explanation)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Negative Factors */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
            <TrendingDown className="w-4 h-4" />
            Negative Recovery Drivers
          </div>
          <div className="space-y-2">
            {shapInfo.top_negative_factors.length === 0 ? (
              <p className="text-xs text-surface-200/40 italic">No significant negative factors.</p>
            ) : (
              shapInfo.top_negative_factors.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-surface-100 font-mono text-[11px]">{formatFeatureName(item.feature)}</span>
                    <span className="font-extrabold text-rose-400 font-mono">{item.importance}</span>
                  </div>
                  <p className="text-[11px] text-surface-200/70 mt-1">{stripModuleText(item.explanation)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SHAPFactors;
