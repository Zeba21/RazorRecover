import React from 'react';
import { GitCommit, CheckCircle, AlertTriangle, Play, Zap } from 'lucide-react';
import { TimelineEvent, renderSafeText } from '../../services/dashboardApi';

interface AuditTimelineProps {
  timeline: TimelineEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ timeline }) => {
  const getStepIcon = (eventType: string) => {
    if (eventType.includes('success') || eventType.includes('recovered')) {
      return <Zap className="w-4 h-4 text-emerald-400" />;
    }
    if (eventType.includes('failed')) {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    if (eventType.includes('execute') || eventType.includes('retry')) {
      return <Play className="w-4 h-4 text-indigo-400" />;
    }
    return <GitCommit className="w-4 h-4 text-sky-400" />;
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-surface-100">Audit Trail Timeline</h3>
        </div>
        <span className="text-xs text-surface-200/40 font-mono font-semibold">
          Chronological Event Sequence
        </span>
      </div>

      {timeline.length === 0 ? (
        <p className="text-xs text-surface-200/40 italic py-4 text-center">
          No audit timeline events logged yet.
        </p>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-sky-500 before:to-emerald-500">
          {timeline.map((item, idx) => (
            <div key={item.id || idx} className="relative flex items-start gap-4 text-xs group">
              {/* Timeline Dot Icon */}
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-surface-950 border-2 border-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                {getStepIcon(item.event_type)}
              </div>

              {/* Step Card Content */}
              <div className="flex-1 bg-surface-900/60 p-3.5 rounded-xl border border-white/5 group-hover:border-indigo-500/20 transition">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-bold text-surface-100 text-xs">{item.title}</h4>
                  <span className="text-[10px] text-surface-200/40 font-mono">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                  </span>
                </div>
                {item.details && (
                  <p className="text-[11px] text-surface-200/70 leading-relaxed font-mono">
                    {renderSafeText(item.details)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditTimeline;
