import React from 'react';
import { Activity, Bot, ShieldCheck, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { ActivityEvent, renderSafeText } from '../../services/dashboardApi';

interface AIActivityProps {
  events: ActivityEvent[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const AIActivity: React.FC<AIActivityProps> = ({
  events,
  loading = false,
  error = null,
  onRefresh
}) => {
  const getEventIcon = (eventType: string, severity: string) => {
    if (eventType.includes('success') || eventType.includes('recovered')) {
      return <Zap className="w-4 h-4 text-emerald-400" />;
    }
    if (eventType.includes('guardrail')) {
      return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
    }
    if (severity === 'warning' || eventType.includes('failed')) {
      return <AlertCircle className="w-4 h-4 text-amber-400" />;
    }
    return <Bot className="w-4 h-4 text-sky-400" />;
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-surface-100 tracking-tight">AI Agent Activity</h2>
            <p className="text-[11px] text-surface-200/50">Live audit stream of AI workflow actions</p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-surface-200/60 hover:text-surface-100 transition cursor-pointer"
            title="Refresh Activity Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 w-full bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-xs text-rose-300/80 bg-rose-500/10 rounded-xl border border-rose-500/20">
            <p className="font-semibold">Failed to load activity stream</p>
            <p className="text-[11px] opacity-70 mt-1">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-xs text-surface-200/40">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No recent AI agent activity logged.</p>
          </div>
        ) : (
          events.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-surface-900/60 border border-white/5 hover:border-indigo-500/20 transition flex items-start gap-3 text-xs"
            >
              <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-white/5 border border-white/5">
                {getEventIcon(item.event_type, item.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-surface-100 truncate">{item.title}</p>
                  <span className="text-[10px] text-surface-200/40 font-mono shrink-0">
                    {formatTime(item.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-surface-200/70 mt-0.5 line-clamp-2 leading-relaxed">
                  {renderSafeText(item.description)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIActivity;
