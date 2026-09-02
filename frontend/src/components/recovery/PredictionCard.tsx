import React from 'react';
import { Brain, Cpu } from 'lucide-react';
import { PredictionInfo } from '../../services/dashboardApi';

interface PredictionCardProps {
  prediction: PredictionInfo;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  const probPercent = (prediction.recovery_probability * 100).toFixed(2);

  const getRiskBadge = (risk: string) => {
    switch (risk.toUpperCase()) {
      case 'HIGH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'LOW':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-surface-100">AI XGBoost Prediction</h3>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-mono text-surface-200/50">
          <Cpu className="w-3.5 h-3.5" /> {prediction.model_version}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-surface-200/50 uppercase tracking-wider font-semibold">Recovery Probability</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl lg:text-4xl font-black text-indigo-300 font-mono">
              {probPercent}%
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${getRiskBadge(prediction.risk_level)}`}>
              {prediction.risk_level} RISK
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-surface-900/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              prediction.recovery_probability >= 0.7
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : prediction.recovery_probability >= 0.4
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-rose-500 to-pink-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, prediction.recovery_probability * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default PredictionCard;
