import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, RefreshCw, ChevronLeft, ChevronRight, 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock, User
} from 'lucide-react';
import { fetchAuditLogs, AuditItem } from '../services/dashboardApi';

export const AuditExplorer: React.FC = () => {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [guardrailFilter, setGuardrailFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuditLogs({
        search: search.trim() || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        guardrail_result: guardrailFilter !== 'all' ? guardrailFilter : undefined,
        page,
        limit
      });
      setLogs(data.logs);
      setTotalCount(data.pagination.total);
      setTotalPages(data.pagination.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, actionFilter, guardrailFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const getGuardrailBadge = (result: string) => {
    const res = result.toUpperCase();
    if (res.includes('APPROVED') || res.includes('PASSED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> APPROVED
        </span>
      );
    }
    if (res.includes('FLAGGED') || res.includes('HUMAN')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" /> FLAGGED FOR HUMAN
        </span>
      );
    }
    if (res.includes('STOPPED')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <XCircle className="w-3 h-3" /> STOPPED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3 h-3" /> REJECTED
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Audit Explorer</h1>
          </div>
          <p className="text-xs text-surface-200/60 mt-1">
            Complete real-time audit trail of all AI decisions, guardrail checks, and payment recovery actions.
          </p>
        </div>

        <button
          onClick={() => { setPage(1); loadData(); }}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-card hover:bg-white/10 text-surface-100 text-xs font-semibold transition-all duration-200 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-2xl space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-surface-200/40" />
            <input
              type="text"
              placeholder="Search action, reason, actor, or case ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-surface-100 placeholder:text-surface-200/40 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full bg-surface-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-surface-100 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="all">All Actions</option>
              <option value="RETRY">RETRY_PAYMENT</option>
              <option value="PAYMENT_LINK">SEND_PAYMENT_LINK</option>
              <option value="REMINDER">SEND_REMINDER</option>
              <option value="ESCALATE">ESCALATE_TO_HUMAN</option>
              <option value="STOP">STOP</option>
            </select>
          </div>

          {/* Guardrail Result Filter */}
          <div>
            <select
              value={guardrailFilter}
              onChange={(e) => { setGuardrailFilter(e.target.value); setPage(1); }}
              className="w-full bg-surface-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-surface-100 focus:outline-none focus:border-indigo-500/50"
            >
              <option value="all">All Guardrail Results</option>
              <option value="APPROVED">APPROVED / PASSED</option>
              <option value="FLAGGED">FLAGGED FOR HUMAN</option>
              <option value="STOPPED">STOPPED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
            <p className="text-xs text-surface-200/60">Loading audit records from database...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3 px-4">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-xs font-medium text-rose-300">{error}</p>
            <button
              onClick={loadData}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center space-y-3 px-4">
            <ShieldCheck className="w-10 h-10 text-surface-200/30 mx-auto" />
            <p className="text-sm font-semibold text-surface-200/80">No Audit Events Found</p>
            <p className="text-xs text-surface-200/40 max-w-sm mx-auto">
              No audit logs match your search or filter criteria. Try adjusting your search query or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-surface-200/60 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Case ID</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">AI Recommendation</th>
                  <th className="py-3.5 px-4">Guardrail Result</th>
                  <th className="py-3.5 px-4">Execution Result</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">System Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-surface-200/80">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-surface-200/40" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-indigo-400 font-semibold">
                      {log.case_id.length > 12 ? `${log.case_id.substring(0, 8)}...` : log.case_id}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans font-semibold text-surface-100">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-sans text-surface-200/80 max-w-xs truncate" title={log.reason}>
                      {log.reason}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans text-surface-200/70">
                      {log.ai_recommendation}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans">
                      {getGuardrailBadge(log.guardrail_result)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.execution_result.includes('SUCCESS') ? 'bg-emerald-500/20 text-emerald-300' :
                        log.execution_result.includes('FAILED') ? 'bg-rose-500/20 text-rose-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {log.execution_result}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-surface-100">
                      {log.amount > 0 ? `₹${log.amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans text-surface-200/80">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-900 border border-white/5">
                        <User className="w-2.5 h-2.5 text-indigo-400" />
                        {log.actor}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-surface-200/50 text-[10px]">
                      {log.system_version}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/[0.01]">
            <p className="text-xs text-surface-200/60 font-sans">
              Showing <span className="font-semibold text-surface-100">{logs.length}</span> of{' '}
              <span className="font-semibold text-surface-100">{totalCount}</span> audit records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-surface-100" />
              </button>
              <span className="text-xs font-mono font-semibold text-surface-100 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-surface-100" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditExplorer;
