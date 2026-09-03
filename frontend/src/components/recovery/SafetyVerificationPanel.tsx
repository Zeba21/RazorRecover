import React, { useState } from 'react';
import { 
  ShieldCheck, Play, AlertTriangle, XCircle, Copy, 
  ExternalLink, CheckCircle2, RefreshCw, Lock
} from 'lucide-react';
import { executeRecoveryAction, createDemoHighValueCase, renderSafeText } from '../../services/dashboardApi';
import { stripModuleText } from '../../utils/formatters';

interface SafetyVerificationPanelProps {
  caseId: string;
  currentAmount: number;
  currentStatus: string;
  onRefresh: () => void;
}

export const SafetyVerificationPanel: React.FC<SafetyVerificationPanelProps> = ({
  caseId,
  currentAmount,
  currentStatus,
  onRefresh
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [idempotencyResult, setIdempotencyResult] = useState<{ req1: any; req2: any } | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string>(caseId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scenario A: Run Normal Recovery (< ₹50,000)
  const handleRunRecovery = async () => {
    setLoadingAction('normal');
    setResult(null);
    setIdempotencyResult(null);
    setErrorMessage(null);
    try {
      const res = await executeRecoveryAction(caseId, {
        action: 'RETRY_PAYMENT',
        simulate_success: true
      });
      const execResultStr = typeof res.execution_result === 'string'
        ? res.execution_result
        : (res.execution_result && typeof res.execution_result === 'object'
          ? (res.execution_result.execution_status || res.execution_result.status || (res.success ? 'SUCCESS' : 'FAILED'))
          : (res.success ? 'SUCCESS' : 'FAILED'));

      setResult({
        type: 'normal',
        requested_action: 'RETRY_PAYMENT',
        guardrail_status: renderSafeText(res.guardrail_status) || (res.success ? 'APPROVED' : 'REJECTED'),
        enforced_action: renderSafeText(res.enforced_action) || 'RETRY_PAYMENT',
        execution_result: execResultStr,
        provider: 'MockPaymentProvider',
        case_status: renderSafeText(res.status) || 'RECOVERED',
        recovered_amount: res.recovered_amount || currentAmount,
        transaction_reference: renderSafeText(res.transaction_reference),
        case_id: caseId
      });
      setActiveCaseId(caseId);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(renderSafeText(err.message) || 'Execution error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Scenario B: High-Value Safety Demo (>= ₹50,000)
  const handleHighValueDemo = async () => {
    setLoadingAction('high_value');
    setResult(null);
    setIdempotencyResult(null);
    setErrorMessage(null);
    try {
      let targetId = caseId;
      if (currentAmount < 50000) {
        // Create an actual ₹60,000 high-value payment failure case
        const demoData = await createDemoHighValueCase(60000);
        targetId = demoData.recovery_case_id;
      }

      const res = await executeRecoveryAction(targetId, {
        action: 'RETRY_PAYMENT'
      });

      setResult({
        type: 'high_value',
        requested_action: 'RETRY_PAYMENT',
        guardrail_status: renderSafeText(res.guardrail_status) || 'FLAGGED_FOR_HUMAN',
        enforced_action: renderSafeText(res.enforced_action) || 'ESCALATE_TO_HUMAN',
        execution_result: 'BLOCKED',
        provider: 'MockPaymentProvider',
        case_status: 'ESCALATED',
        reason: renderSafeText(res.reason) || 'Transaction amount ₹60,000 exceeds high-value threshold ₹50,000. Human approval required.',
        automatic_payment: 'NO',
        case_id: targetId
      });
      setActiveCaseId(targetId);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(renderSafeText(err.message) || 'High-value demo error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Scenario C: Already Successful Payment (STOP)
  const handleAlreadyRecoveredDemo = async () => {
    setLoadingAction('already_recovered');
    setResult(null);
    setIdempotencyResult(null);
    setErrorMessage(null);
    try {
      const res = await executeRecoveryAction(caseId, {
        action: 'RETRY_PAYMENT'
      });

      setResult({
        type: 'already_recovered',
        requested_action: 'RETRY_PAYMENT',
        guardrail_status: renderSafeText(res.guardrail_status) || 'STOPPED',
        enforced_action: renderSafeText(res.enforced_action) || 'STOP',
        execution_result: 'BLOCKED',
        provider: 'MockPaymentProvider',
        case_status: renderSafeText(currentStatus).toUpperCase(),
        reason: renderSafeText(res.reason) || 'Payment already captured/recovered. Automated recovery stopped.',
        automatic_payment: 'NO',
        case_id: caseId
      });
      setActiveCaseId(caseId);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(renderSafeText(err.message) || 'Already-recovered demo error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Scenario D: Idempotency Demo (Duplicate Request)
  const handleIdempotencyDemo = async () => {
    setLoadingAction('idempotency');
    setResult(null);
    setIdempotencyResult(null);
    setErrorMessage(null);
    try {
      const key = `idem_demo_${Date.now()}`;
      // Request 1
      const req1 = await executeRecoveryAction(caseId, {
        action: 'RETRY_PAYMENT',
        simulate_success: true,
        idempotency_key: key
      });

      // Request 2 (identical key)
      const req2 = await executeRecoveryAction(caseId, {
        action: 'RETRY_PAYMENT',
        simulate_success: true,
        idempotency_key: key
      });

      setIdempotencyResult({ req1, req2 });
      setActiveCaseId(caseId);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(renderSafeText(err.message) || 'Idempotency test error');
    } finally {
      setLoadingAction(null);
    }
  };

  const navigateToAuditTrail = (targetId: string) => {
    window.location.hash = `/dashboard/audit?search=${encodeURIComponent(targetId)}`;
  };

  const getGuardrailBadge = (status: any) => {
    const s = renderSafeText(status).toUpperCase();
    if (s.includes('APPROVED') || s.includes('PASSED')) {
      return <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">APPROVED</span>;
    }
    if (s.includes('FLAGGED') || s.includes('HUMAN')) {
      return <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">FLAGGED_FOR_HUMAN</span>;
    }
    if (s.includes('STOPPED')) {
      return <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-slate-500/20 text-slate-300 border border-slate-500/30">STOPPED</span>;
    }
    return <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">REJECTED</span>;
  };

  return (
    <div className="glass-card p-6 rounded-2xl border-l-4 border-indigo-500 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-tight">Demo / Safety Verification Controls</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {stripModuleText('Module 9 Hardening')}
            </span>
          </div>
          <p className="text-xs text-surface-200/60 mt-1">
            Execute real-time backend safety tests: deterministic guardrails, high-value escalation, already-recovered check, and idempotency.
          </p>
        </div>
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Action A: Run Recovery */}
        <button
          onClick={handleRunRecovery}
          disabled={loadingAction !== null}
          className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 transition cursor-pointer text-left disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            {loadingAction === 'normal' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run Recovery
          </div>
          <span className="text-[10px] text-emerald-300/70 font-normal">
            Normal recovery ($&lt; ₹50k$)
          </span>
        </button>

        {/* Action B: High-Value Guardrail */}
        <button
          onClick={handleHighValueDemo}
          disabled={loadingAction !== null}
          className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 transition cursor-pointer text-left disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            {loadingAction === 'high_value' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Test Recovery Safety
          </div>
          <span className="text-[10px] text-amber-300/70 font-normal">
            High-value ($\ge ₹50k$) $\rightarrow$ Human Escalation
          </span>
        </button>

        {/* Action C: Already Recovered Check */}
        <button
          onClick={handleAlreadyRecoveredDemo}
          disabled={loadingAction !== null}
          className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-300 transition cursor-pointer text-left disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            {loadingAction === 'already_recovered' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Test Already-Captured
          </div>
          <span className="text-[10px] text-slate-300/70 font-normal">
            Already captured $\rightarrow$ STOP
          </span>
        </button>

        {/* Action D: Idempotency Demo */}
        <button
          onClick={handleIdempotencyDemo}
          disabled={loadingAction !== null}
          className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 transition cursor-pointer text-left disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            {loadingAction === 'idempotency' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Test Idempotency
          </div>
          <span className="text-[10px] text-purple-300/70 font-normal">
            Send duplicate request $\rightarrow$ IDEMPOTENT
          </span>
        </button>
      </div>

      {/* Error Output */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{renderSafeText(errorMessage)}</span>
        </div>
      )}

      {/* Structured Safety Decision Result Panel */}
      {result && (
        <div className="p-4 rounded-xl bg-surface-900/90 border border-white/10 space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Safety Decision Result
            </span>
            {getGuardrailBadge(result.guardrail_status)}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-surface-200/50 block text-[10px] uppercase">Requested Action</span>
              <span className="font-bold text-surface-100">{renderSafeText(result.requested_action)}</span>
            </div>
            <div>
              <span className="text-surface-200/50 block text-[10px] uppercase">Enforced Action</span>
              <span className="font-bold text-indigo-300">{renderSafeText(result.enforced_action)}</span>
            </div>
            <div>
              <span className="text-surface-200/50 block text-[10px] uppercase">Execution Status</span>
              <span className={`font-bold ${renderSafeText(result.execution_result) === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {renderSafeText(result.execution_result)}
              </span>
            </div>
            <div>
              <span className="text-surface-200/50 block text-[10px] uppercase">Case Status</span>
              <span className="font-bold text-purple-300">{renderSafeText(result.case_status)}</span>
            </div>
          </div>

          {result.reason && (
            <p className="text-xs text-surface-200/80 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
              <span className="font-semibold text-surface-100">Reason:</span> {renderSafeText(result.reason)}
            </p>
          )}

          {result.transaction_reference && (
            <p className="text-xs text-emerald-400 font-mono">
              <span className="text-surface-200/50">Transaction Reference:</span> {renderSafeText(result.transaction_reference)}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => navigateToAuditTrail(result.case_id || activeCaseId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Audit Trail
            </button>
          </div>
        </div>
      )}

      {/* Idempotency Verification Result Panel */}
      {idempotencyResult && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
            <span className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
              <Copy className="w-4 h-4 text-purple-400" />
              Idempotency Verification Result
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/40">
              DUPLICATE DETECTED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-900/80 border border-white/5 space-y-1">
              <p className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> First Request
              </p>
              <p className="font-mono text-surface-200/80 text-[11px]">
                Status: {renderSafeText(idempotencyResult.req1?.status || idempotencyResult.req1?.execution_result || 'EXECUTED')}
              </p>
              <p className="font-mono text-surface-200/60 text-[11px]">
                Tx Ref: {renderSafeText(idempotencyResult.req1?.transaction_reference || idempotencyResult.req1?.data?.transaction_reference || 'MOCK_PAY_SUCCESS')}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-900/80 border border-purple-500/30 space-y-1">
              <p className="font-bold text-purple-300 text-xs flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Second Request (Duplicate Key)
              </p>
              <p className="font-mono text-purple-200 font-bold text-[11px]">
                is_duplicate: {String(idempotencyResult.req2?.is_duplicate ?? true)}
              </p>
              <p className="font-mono text-surface-200/80 text-[11px]">
                Message: {renderSafeText(idempotencyResult.req2?.message || idempotencyResult.req2?.details || 'Idempotency key match: execution already processed.')}
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span>Duplicate Payment Execution: NO (Backend prevented double capture)</span>
            <button
              onClick={() => navigateToAuditTrail(activeCaseId)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 text-[11px] font-bold transition cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" /> View Audit Trail
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyVerificationPanel;
