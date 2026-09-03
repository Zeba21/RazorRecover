import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, DollarSign, Clock, CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, BarChart3, PieChart as PieChartIcon, ShieldAlert, ArrowUpRight
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { fetchRecoveryAnalytics, RecoveryAnalyticsData } from '../services/dashboardApi';

const COLOR_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export const RecoveryAnalytics: React.FC = () => {
  const [data, setData] = useState<RecoveryAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchRecoveryAnalytics();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-400 mx-auto" />
        <p className="text-xs text-surface-200/60 font-medium">Calculating database-derived recovery analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center space-y-3 glass-card rounded-2xl p-6 max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <p className="text-sm font-semibold text-rose-300">Analytics Error</p>
        <p className="text-xs text-surface-200/60">{error || 'Unable to load analytics data'}</p>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  // Outcome breakdown for PieChart
  const outcomeData = [
    { name: 'Successful Retries', value: data.successful_recovery_attempts, color: '#10b981' },
    { name: 'Failed Retries', value: data.failed_recovery_attempts, color: '#f43f5e' },
    { name: 'Escalated Cases', value: data.escalated_cases_count, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Distinction Header Banner */}
      <div className="glass-card p-4 rounded-2xl border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                BUSINESS RECOVERY METRICS
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1">Recovery Analytics</h1>
            <p className="text-xs text-surface-200/60">
              Live financial and operational metrics calculated directly from database recovery attempts.
            </p>
          </div>
        </div>

        <button
          onClick={loadAnalytics}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-card hover:bg-white/10 text-surface-100 text-xs font-semibold transition-all duration-200 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* 8 Required Business Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Revenue at Risk */}
        <div className="glass-card p-4 rounded-2xl space-y-2 border-l-2 border-amber-500/50">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Revenue at Risk</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            ₹{data.total_revenue_at_risk.toLocaleString()}
          </div>
          <p className="text-[11px] text-surface-200/40">Active unrecovered payment failure cases</p>
        </div>

        {/* Metric 2: Total Revenue Recovered */}
        <div className="glass-card p-4 rounded-2xl space-y-2 border-l-2 border-emerald-500/50">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Revenue Recovered</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ₹{data.total_revenue_recovered.toLocaleString()}
          </div>
          <p className="text-[11px] text-surface-200/40">Total successfully captured revenue</p>
        </div>

        {/* Metric 3: Recovery Rate */}
        <div className="glass-card p-4 rounded-2xl space-y-2 border-l-2 border-indigo-500/50">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Recovery Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-300 font-mono">
            {data.recovery_rate}%
          </div>
          <p className="text-[11px] text-surface-200/40">Recovered ÷ Total Handled Revenue</p>
        </div>

        {/* Metric 4: Average Recovery Time */}
        <div className="glass-card p-4 rounded-2xl space-y-2 border-l-2 border-blue-500/50">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Avg Recovery Time</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {data.average_recovery_time_hours} hrs
          </div>
          <p className="text-[11px] text-surface-200/40">Mean time from failure to capture</p>
        </div>

        {/* Metric 5: Successful Recovery Attempts */}
        <div className="glass-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Successful Attempts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {data.successful_recovery_attempts}
          </div>
          <p className="text-[11px] text-emerald-400/80 font-medium">Executing payment retries</p>
        </div>

        {/* Metric 6: Failed Recovery Attempts */}
        <div className="glass-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Failed Attempts</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {data.failed_recovery_attempts}
          </div>
          <p className="text-[11px] text-rose-400/80 font-medium">Declined retry attempts</p>
        </div>

        {/* Metric 7: Escalated Cases */}
        <div className="glass-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Escalated Cases</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {data.escalated_cases_count}
          </div>
          <p className="text-[11px] text-amber-400/80 font-medium">Flagged for human team</p>
        </div>

        {/* Metric 8: Total Cases Handled */}
        <div className="glass-card p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-surface-200/60">
            <span className="text-xs font-medium">Total Cases Processed</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {data.total_cases_count}
          </div>
          <p className="text-[11px] text-surface-200/40">Total recovery cases in database</p>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue Time Series */}
        <div className="glass-card p-5 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Revenue Recovery & Risk Over Time
            </h3>
            <span className="text-[10px] text-surface-200/40 font-mono">Database Time Series</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.time_series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRecovered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="formatted_date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="revenue_recovered" name="Revenue Recovered" stroke="#10b981" fillOpacity={1} fill="url(#gradRecovered)" strokeWidth={2} />
                <Area type="monotone" dataKey="revenue_at_risk" name="Revenue at Risk" stroke="#f59e0b" fillOpacity={1} fill="url(#gradRisk)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Outcome Distribution */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-400" />
            Execution Outcome Distribution
          </h3>

          <div className="h-64 w-full flex items-center justify-center">
            {outcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(val) => <span className="text-xs text-surface-200/80">{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-surface-200/40">No execution outcomes recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Metric 8 Visualization: Revenue by Intervention Type */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Revenue Recovered by Intervention Strategy
        </h3>

        {data.revenue_by_intervention_type.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenue_by_intervention_type} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Recovered Revenue']}
                />
                <Bar dataKey="revenue_recovered" name="Recovered Revenue" fill="#6366f1" radius={[6, 6, 0, 0]}>
                  {data.revenue_by_intervention_type.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-surface-200/40 py-8 text-center">No intervention revenue data recorded.</p>
        )}
      </div>
    </div>
  );
};

export default RecoveryAnalytics;
