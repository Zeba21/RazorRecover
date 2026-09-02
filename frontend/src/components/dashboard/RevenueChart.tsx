import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { RevenuePoint } from '../../services/dashboardApi';

interface RevenueChartProps {
  data: RevenuePoint[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  loading = false,
  error = null,
  onRefresh
}) => {
  const [timeGrouping, setTimeGrouping] = useState<'daily' | 'weekly'>('daily');

  // Format monetary value for tooltips & axes
  const formatINR = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
    return `₹${value.toLocaleString()}`;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card p-3 shadow-2xl border border-indigo-500/30 text-xs rounded-xl backdrop-blur-md">
          <p className="font-semibold text-surface-100 mb-2 border-b border-white/10 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 my-1">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-surface-200/70">{entry.name}:</span>
              <span className="font-bold text-surface-100">
                ₹{Number(entry.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-surface-100 tracking-tight">
              Revenue at Risk vs Revenue Recovered
            </h2>
          </div>
          <p className="text-xs text-surface-200/50 mt-1">
            Real-time fintech payment recovery analytics from backend data
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Grouping Selector */}
          <div className="bg-surface-900/60 p-1 rounded-xl border border-white/10 flex items-center text-xs">
            <button
              onClick={() => setTimeGrouping('daily')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                timeGrouping === 'daily'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-surface-200/60 hover:text-surface-100'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setTimeGrouping('weekly')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                timeGrouping === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-surface-200/60 hover:text-surface-100'
              }`}
            >
              Weekly
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-surface-200/70 hover:text-surface-100 transition cursor-pointer"
              title="Refresh Chart"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full h-72 sm:h-80 relative">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
            <div className="w-full h-full bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-indigo-400/40 animate-spin" />
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-rose-500/5 rounded-xl border border-rose-500/20">
            <AlertTriangle className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-sm font-semibold text-rose-200">Unable to load revenue chart</p>
            <p className="text-xs text-rose-300/60 mt-1 max-w-sm">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
              >
                Retry Loading
              </button>
            )}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-surface-900/40 rounded-xl border border-white/5">
            <TrendingUp className="w-10 h-10 text-surface-200/20 mb-2" />
            <p className="text-sm font-semibold text-surface-200/70">No revenue data available yet.</p>
            <p className="text-xs text-surface-200/40 mt-1">Run the Recovery Demo to populate payment events.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradientRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientRecovered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formatted_date"
                stroke="rgba(226,232,240,0.4)"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(226,232,240,0.4)"
                tick={{ fontSize: 11 }}
                tickFormatter={formatINR}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />

              <Area
                type="monotone"
                dataKey="revenue_at_risk"
                name="Revenue at Risk"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradientRisk)"
              />

              <Area
                type="monotone"
                dataKey="revenue_recovered"
                name="Revenue Recovered"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#gradientRecovered)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
