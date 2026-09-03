import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, DollarSign, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import KPICard from '../components/dashboard/KPICard';
import RevenueChart from '../components/dashboard/RevenueChart';
import RecoveryCases from '../components/dashboard/RecoveryCases';
import AIActivity from '../components/dashboard/AIActivity';
import RunRecoveryDemo from '../components/dashboard/RunRecoveryDemo';
import { stripModuleText } from '../utils/formatters';
import {
  fetchDashboardSummary,
  fetchRevenueChart,
  fetchRecoveryCases,
  fetchActivityLog,
  DashboardSummary,
  RevenuePoint,
  RecoveryCase,
  ActivityEvent
} from '../services/dashboardApi';

interface DashboardPageProps {
  onSelectCase: (caseId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectCase }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  const [activityLogs, setActivityLogs] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    // 1. Load summary
    setSummaryLoading(true);
    setSummaryError(null);
    fetchDashboardSummary()
      .then(setSummary)
      .catch(err => setSummaryError(err.message))
      .finally(() => setSummaryLoading(false));

    // 2. Load revenue chart
    setRevenueLoading(true);
    setRevenueError(null);
    fetchRevenueChart()
      .then(setRevenueData)
      .catch(err => setRevenueError(err.message))
      .finally(() => setRevenueLoading(false));

    // 3. Load recovery cases
    setCasesLoading(true);
    setCasesError(null);
    fetchRecoveryCases()
      .then(setCases)
      .catch(err => setCasesError(err.message))
      .finally(() => setCasesLoading(false));

    // 4. Load AI activity
    setActivityLoading(true);
    setActivityError(null);
    fetchActivityLog()
      .then(setActivityLogs)
      .catch(err => setActivityError(err.message))
      .finally(() => setActivityLoading(false));
  }, []);

  useEffect(() => {
    loadDashboardData();
    // Refresh periodically every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Callback when demo successfully runs
  const handleDemoSuccess = () => {
    loadDashboardData();
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Top Header & Hero Run Demo Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-surface-100 tracking-tight">
              RazorRecover <span className="gradient-text">Dashboard</span>
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              {stripModuleText('Module 8 Active')}
            </span>
          </div>
          <p className="text-xs lg:text-sm text-surface-200/50 mt-1 max-w-xl">
            AI-driven SaaS revenue recovery dashboard. Real-time predictions, SHAP explainability, and automated payment simulation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-surface-200/70 hover:text-surface-100 transition cursor-pointer"
            title="Refresh All Dashboard Data"
          >
            <RefreshCw className={`w-4 h-4 ${(summaryLoading || casesLoading) ? 'animate-spin' : ''}`} />
          </button>

          {/* Hero Run Recovery Demo Action Button */}
          <RunRecoveryDemo onSuccess={handleDemoSuccess} />
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Revenue at Risk */}
        <KPICard
          title="Revenue at Risk"
          value={summary ? `₹${summary.revenue_at_risk.toLocaleString()}` : '₹0'}
          description="Active open & in-recovery failed payments"
          icon={AlertCircle}
          variant="warning"
          loading={summaryLoading}
          error={summaryError}
        />

        {/* Card 2: Revenue Recovered */}
        <KPICard
          title="Revenue Recovered"
          value={summary ? `₹${summary.revenue_recovered.toLocaleString()}` : '₹0'}
          description="Total successfully recovered revenue"
          icon={DollarSign}
          variant="success"
          loading={summaryLoading}
          error={summaryError}
        />

        {/* Card 3: Recovery Rate */}
        <KPICard
          title="Recovery Rate"
          value={summary ? `${summary.recovery_rate.toFixed(1)}%` : '0%'}
          description="Recovered revenue / Total handled revenue"
          icon={CheckCircle2}
          variant="primary"
          loading={summaryLoading}
          error={summaryError}
        />

        {/* Card 4: Active Recovery Cases */}
        <KPICard
          title="Active Recovery Cases"
          value={summary ? summary.active_cases_count : 0}
          description="Open & in-recovery cases requiring AI action"
          icon={ShieldAlert}
          variant="info"
          loading={summaryLoading}
          error={summaryError}
        />
      </div>

      {/* MAIN CONTENT GRID: Chart & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Main Revenue Chart (2 Columns) */}
        <div className="lg:col-span-2">
          <RevenueChart
            data={revenueData}
            loading={revenueLoading}
            error={revenueError}
            onRefresh={loadDashboardData}
          />
        </div>

        {/* AI Agent Activity Panel (1 Column) */}
        <div className="lg:col-span-1">
          <AIActivity
            events={activityLogs}
            loading={activityLoading}
            error={activityError}
            onRefresh={loadDashboardData}
          />
        </div>
      </div>

      {/* RECOVERY CASES TABLE */}
      <div>
        <RecoveryCases
          cases={cases}
          loading={casesLoading}
          error={casesError}
          onSelectCase={onSelectCase}
          onRefresh={loadDashboardData}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
