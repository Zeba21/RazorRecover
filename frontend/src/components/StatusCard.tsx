import type { LucideIcon } from 'lucide-react';

interface StatusCardProps {
  icon: LucideIcon;
  title: string;
  status: 'connected' | 'disconnected';
  detail: string;
}

export default function StatusCard({ icon: Icon, title, status, detail }: StatusCardProps) {
  const isConnected = status === 'connected';

  return (
    <div className="glass-card p-5 hover:border-brand-500/30 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center group-hover:bg-brand-600/25 transition-colors">
          <Icon className="w-5 h-5 text-brand-400" />
        </div>
        {/* Status dot */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isConnected ? 'text-success' : 'text-danger'}`}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-success animate-ping' : 'bg-danger'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isConnected ? 'bg-success' : 'bg-danger'
              }`}
            />
          </span>
        </div>
      </div>

      <h3 className="mt-4 text-surface-50 font-semibold text-sm">{title}</h3>
      <p className="mt-1 text-surface-200/50 text-xs">{detail}</p>
    </div>
  );
}
