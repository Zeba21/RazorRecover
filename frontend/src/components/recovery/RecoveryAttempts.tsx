import React from 'react';
import { History, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { AttemptInfo } from '../../services/dashboardApi';

interface RecoveryAttemptsProps {
  attempts: AttemptInfo[];
}

export const RecoveryAttempts: React.FC<RecoveryAttemptsProps> = ({ attempts }) => {
  const getAttemptStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" /> IN PROGRESS
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> SKIPPED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3.5 h-3.5" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-surface-100">Recovery Execution Attempts</h3>
        </div>
        <span className="text-xs text-surface-200/40 font-mono font-semibold">
          {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'} recorded
        </span>
      </div>

      {attempts.length === 0 ? (
        <p className="text-xs text-surface-200/40 italic py-4 text-center">
          No execution attempts recorded for this recovery case yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-surface-900/60 text-surface-200/60 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Action / Strategy</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 font-mono">Tx Reference</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-surface-100 font-medium">
              {attempts.map(att => (
                <tr key={att.id} className="hover:bg-white/5 transition">
                  <td className="py-3 px-3 font-mono text-surface-200/50">#{att.attempt_number}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-indigo-300 font-mono">{att.action || att.strategy}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-surface-200 uppercase font-mono">
                      {att.provider || 'mock'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold">₹{att.amount.toLocaleString()}</td>
                  <td className="py-3 px-3">{getAttemptStatusBadge(att.status)}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-surface-200/70">
                    {att.transaction_reference || 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-[11px] text-surface-200/50">
                    {att.timestamp ? new Date(att.timestamp).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecoveryAttempts;
