import React, { useState } from 'react';
import { Search, Filter, ChevronRight, AlertCircle, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { RecoveryCase } from '../../services/dashboardApi';

interface RecoveryCasesProps {
  cases: RecoveryCase[];
  loading?: boolean;
  error?: string | null;
  onSelectCase: (caseId: string) => void;
  onRefresh?: () => void;
}

export const RecoveryCases: React.FC<RecoveryCasesProps> = ({
  cases,
  loading = false,
  error = null,
  onSelectCase,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const statusOptions = ['all', 'open', 'in_recovery', 'recovered', 'failed', 'escalated'];
  const riskOptions = ['all', 'HIGH', 'MEDIUM', 'LOW'];

  // Filter cases client side
  const filteredCases = cases.filter(c => {
    // Search matching
    const matchesSearch =
      searchTerm === '' ||
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.payment_id && c.payment_id.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status matching
    const matchesStatus =
      statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter.toLowerCase();

    // Risk matching
    const matchesRisk =
      riskFilter === 'all' || (c.risk || '').toUpperCase() === riskFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'recovered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            RECOVERED
          </span>
        );
      case 'in_recovery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            IN RECOVERY
          </span>
        );
      case 'escalated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            ESCALATED
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'open':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3.5 h-3.5" />
            OPEN
          </span>
        );
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk.toUpperCase()) {
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            LOW RISK
          </span>
        );
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      {/* Table Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-5">
        <div>
          <h2 className="text-lg font-bold text-surface-100 tracking-tight flex items-center gap-2">
            AI Recovery Cases
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
              {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
            </span>
          </h2>
          <p className="text-xs text-surface-200/50 mt-1">
            Real recovery cases analyzed by Module 4 XGBoost & Module 6 LangGraph
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-surface-200/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, payment ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-surface-100 placeholder:text-surface-200/30 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-900/60 p-1 rounded-xl border border-white/10 text-[11px]">
            <span className="text-surface-200/40 px-2 flex items-center gap-1 font-semibold">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {statusOptions.map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded-lg capitalize transition cursor-pointer font-medium ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-surface-200/60 hover:text-surface-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Risk Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-900/60 p-1 rounded-xl border border-white/10 text-[11px]">
            <span className="text-surface-200/40 px-2 font-semibold">Risk:</span>
            {riskOptions.map(rk => (
              <button
                key={rk}
                onClick={() => setRiskFilter(rk)}
                className={`px-2 py-1 rounded-lg uppercase transition cursor-pointer font-medium ${
                  riskFilter === rk
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-surface-200/60 hover:text-surface-100'
                }`}
              >
                {rk}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-surface-200/70 hover:text-surface-100 transition cursor-pointer"
              title="Refresh Cases"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-surface-950/40">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 w-full bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-sm font-semibold text-rose-200">Unable to load recovery cases</p>
            <p className="text-xs text-rose-300/60 mt-1">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
              >
                Retry Loading
              </button>
            )}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-surface-100">No recovery cases found.</p>
            <p className="text-xs text-surface-200/50 mt-1 max-w-md">
              {cases.length === 0
                ? 'Run the Recovery Demo to create your first recovery case.'
                : 'Try adjusting your search keywords or filter criteria.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-surface-900/80 text-surface-200/60 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Failure Reason</th>
                <th className="py-3 px-4 text-center">Recovery Prob</th>
                <th className="py-3 px-4 text-center">Risk</th>
                <th className="py-3 px-4">AI Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-surface-100 font-medium">
              {filteredCases.map(c => {
                const prob = c.recovery_probability !== null ? Number(c.recovery_probability) : null;
                const probPercent = prob !== null ? (prob * 100).toFixed(2) + '%' : 'N/A';

                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="hover:bg-indigo-500/5 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-surface-100 group-hover:text-indigo-300 transition">
                          {c.customer_name}
                        </p>
                        <p className="text-[11px] text-surface-200/40 font-mono">
                          {c.customer_email || c.id.substring(0, 8)}
                        </p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-extrabold text-surface-100">
                      ₹{c.amount.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-surface-200/80 max-w-[160px] truncate">
                      {c.failure_reason}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {prob !== null ? (
                        <div className="flex flex-col items-center">
                          <span className="font-bold font-mono text-indigo-300">{probPercent}</span>
                          <div className="w-16 bg-white/10 h-1 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                prob >= 0.7 ? 'bg-emerald-400' : prob >= 0.4 ? 'bg-amber-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, prob * 100))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-surface-200/40">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">{getRiskBadge(c.risk)}</td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300 font-semibold">
                      {c.ai_recommended_action}
                    </td>

                    <td className="py-3.5 px-4">{getStatusBadge(c.status)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectCase(c.id);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-600 text-surface-200/60 group-hover:text-white transition"
                        title="View Case Detail"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecoveryCases;
