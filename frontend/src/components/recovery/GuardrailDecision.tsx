import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, UserCheck } from 'lucide-react';
import { GuardrailInfo } from '../../services/dashboardApi';
import { stripModuleText } from '../../utils/formatters';

interface GuardrailDecisionProps {
  guardrail: GuardrailInfo;
}

export const GuardrailDecision: React.FC<GuardrailDecisionProps> = ({ guardrail }) => {
  const getDecisionTheme = (status: string) => {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return {
          icon: ShieldCheck,
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          title: 'Guardrail: APPROVED',
          description: 'All deterministic safety checks passed. Automated execution authorized.'
        };
      case 'FLAGGED_FOR_HUMAN':
      case 'FLAGGED FOR HUMAN':
        return {
          icon: UserCheck,
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          title: 'Guardrail: FLAGGED FOR HUMAN',
          description: 'High-value transaction threshold or max retry limit reached. Human agent review required.'
        };
      case 'STOPPED':
        return {
          icon: ShieldAlert,
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          title: 'Guardrail: STOPPED',
          description: 'Customer opted out or payment already captured. Automated recovery workflow stopped.'
        };
      case 'REJECTED':
      default:
        return {
          icon: ShieldX,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          title: 'Guardrail: REJECTED',
          description: 'Safety check rejected action. Execution blocked by policy rules.'
        };
    }
  };

  const theme = getDecisionTheme(guardrail.status);
  const Icon = theme.icon;

  return (
    <div className="glass-card p-6 border-l-4 border-l-indigo-500 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-surface-100">Deterministic Safety Guardrail</h3>
        </div>
        <span className="text-[10px] font-mono text-surface-200/40 uppercase">{stripModuleText('Module 6 Policy Engine')}</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wide border ${theme.badgeBg}`}>
            {theme.title}
          </span>
        </div>

        <p className="text-xs text-surface-200/80 leading-relaxed font-medium bg-surface-900/60 p-3 rounded-xl border border-white/5">
          {guardrail.reason || theme.description}
        </p>
      </div>
    </div>
  );
};

export default GuardrailDecision;
