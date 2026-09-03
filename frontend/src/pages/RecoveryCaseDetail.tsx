import React, { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, DollarSign, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import PredictionCard from '../components/recovery/PredictionCard';
import SHAPFactors from '../components/recovery/SHAPFactors';
import GuardrailDecision from '../components/recovery/GuardrailDecision';
import RecoveryAttempts from '../components/recovery/RecoveryAttempts';
import AuditTimeline from '../components/recovery/AuditTimeline';
import SafetyVerificationPanel from '../components/recovery/SafetyVerificationPanel';
import { fetchCaseDetail, RecoveryCaseDetail } from '../services/dashboardApi';

interface RecoveryCaseDetailProps {
  caseId: string;
  onBack: () => void;
}

export const RecoveryCaseDetailPage: React.FC<RecoveryCaseDetailProps> = ({ caseId, onBack }) => {
  const [detail, setDetail] = useState<RecoveryCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCaseDetail(caseId);
      setDetail(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery case detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [caseId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up pb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-surface-200/70 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="h-64 w-full glass-card animate-pulse flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-6 animate-fade-in-up pb-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-surface-200/70 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="glass-card p-8 text-center bg-rose-500/5 border-rose-500/20">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-rose-200">Unable to load case detail</h2>
          <p className="text-xs text-rose-300/60 mt-1 max-w-md mx-auto">{error || 'Case not found'}</p>
          <button
            onClick={loadDetail}
            className="mt-4 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { payment, customer, prediction, shap_explanation, guardrail_decision, attempts, audit_timeline } = detail;

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-surface-200/70 hover:text-surface-100 transition cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-extrabold text-surface-100">
                Recovery Case Detail
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {caseId.substring(0, 13)}...
              </span>
            </div>
            <p className="text-xs text-surface-200/50 mt-0.5">
              Customer: <span className="text-surface-100 font-medium">{customer.name}</span> ({customer.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDetail}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-surface-200/70 hover:text-surface-100 transition cursor-pointer"
            title="Refresh Detail"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Payment Info Card */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-surface-100">Payment Information</h3>
            </div>
            <span className="text-[10px] font-mono text-surface-200/40 uppercase font-semibold">
              Safe Metadata
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-surface-200/50">Amount:</span>
              <span className="font-extrabold text-surface-100 font-mono text-sm">
                ₹{payment.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-200/50">Payment Status:</span>
              <span className="font-semibold uppercase text-indigo-300">{payment.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-200/50">Payment Method:</span>
              <span className="font-mono text-surface-200">{payment.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-200/50">Failure Reason:</span>
              <span className="font-medium text-amber-300 max-w-[160px] truncate">
                {payment.error_description || payment.error_reason || 'Decline'}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
              <span className="text-surface-200/40">Created:</span>
              <span className="text-[11px] text-surface-200/60">
                {payment.created_at ? new Date(payment.created_at).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Prediction Card */}
        <PredictionCard prediction={prediction} />

        {/* Recovered Amount & Decision Card */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-surface-100">Recovery Status</h3>
            </div>
            <span className="text-[10px] font-mono text-surface-200/40 uppercase font-semibold">
              Outcome
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-surface-200/50 uppercase font-semibold">Recovered Amount</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">
                ₹{detail.recovered_amount.toLocaleString()}
              </p>
            </div>

            <div className="border-t border-white/5 pt-3">
              <p className="text-[11px] text-surface-200/50 uppercase font-semibold">Recommended Intervention</p>
              <p className="text-sm font-extrabold text-indigo-300 font-mono mt-0.5">
                {detail.recommended_intervention}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SHAP EXPLANATIONS & GUARDRAIL DECISION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SHAPFactors shapInfo={shap_explanation} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <GuardrailDecision guardrail={guardrail_decision} />

          {/* Root Cause Box */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-surface-100">AI Root Cause Diagnosis</h3>
            </div>
            <p className="text-xs text-surface-200/80 leading-relaxed font-medium bg-surface-900/60 p-3.5 rounded-xl border border-white/5">
              {detail.root_cause}
            </p>
          </div>
        </div>
      </div>

      {/* CONTROLLED SAFETY ACTIONS PANEL (MODULE 9 UI) */}
      <SafetyVerificationPanel
        caseId={caseId}
        currentAmount={payment.amount}
        currentStatus={detail.status}
        onRefresh={loadDetail}
      />

      {/* RECOVERY ATTEMPTS TABLE */}
      <div>
        <RecoveryAttempts attempts={attempts} />
      </div>

      {/* AUDIT TIMELINE */}
      <div>
        <AuditTimeline timeline={audit_timeline} />
      </div>
    </div>
  );
};

export default RecoveryCaseDetailPage;
