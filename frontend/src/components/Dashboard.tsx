import StatusCard from './StatusCard';
import {
  RefreshCw,
  Database,
  Cpu,
  Server,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
  responseTime: string;
  services: {
    database: { status: string; error?: string };
    aiService: { status: string; url: string; error?: string };
  };
  environment: string;
}

interface DashboardProps {
  health: HealthData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function Dashboard({ health, loading, error, onRefresh }: DashboardProps) {
  const overallStatus = health?.status ?? 'unknown';
  const isHealthy = overallStatus === 'healthy';

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-50">
            System Dashboard
          </h1>
          <p className="text-surface-200/60 mt-1 text-sm">
            Real-time health overview of the RazorRecover platform
          </p>
        </div>
        <button
          id="btn-refresh"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-brand-600 hover:bg-brand-500 text-white transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
            shadow-lg shadow-brand-600/25 hover:shadow-brand-500/40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Overall status banner */}
      <div className={`animate-fade-in-up delay-100 glass-card p-6 flex items-center gap-4
        ${isHealthy ? 'border-success/30' : 'border-warning/30'}`}>
        {loading ? (
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        ) : error ? (
          <AlertTriangle className="w-8 h-8 text-danger" />
        ) : isHealthy ? (
          <CheckCircle2 className="w-8 h-8 text-success" />
        ) : (
          <AlertTriangle className="w-8 h-8 text-warning" />
        )}
        <div>
          <h2 className="font-bold text-lg text-surface-50">
            {loading
              ? 'Checking system health…'
              : error
              ? 'Backend Unreachable'
              : isHealthy
              ? 'All Systems Operational'
              : 'System Degraded'}
          </h2>
          <p className="text-sm text-surface-200/50 mt-0.5">
            {loading
              ? 'Polling backend health endpoint…'
              : error
              ? error
              : `Responded in ${health?.responseTime} · v${health?.version} · ${health?.environment}`}
          </p>
        </div>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in-up delay-200">
        <StatusCard
          icon={Server}
          title="Backend API"
          status={error ? 'disconnected' : 'connected'}
          detail={error ? 'Unreachable' : `Port 5000 · ${health?.responseTime ?? '—'}`}
        />
        <StatusCard
          icon={Database}
          title="Supabase DB"
          status={health?.services.database.status === 'connected' ? 'connected' : 'disconnected'}
          detail={
            health?.services.database.status === 'connected'
              ? 'PostgreSQL connected'
              : health?.services.database.error ?? 'Not checked'
          }
        />
        <StatusCard
          icon={Cpu}
          title="AI Service"
          status={health?.services.aiService.status === 'connected' ? 'connected' : 'disconnected'}
          detail={
            health?.services.aiService.status === 'connected'
              ? 'FastAPI on :8000'
              : health?.services.aiService.error ?? 'Not checked'
          }
        />
      </div>

      {/* Info footer */}
      {health && (
        <div className="animate-fade-in-up delay-300 text-xs text-surface-200/30 text-center pt-4">
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
