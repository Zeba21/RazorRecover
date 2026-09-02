import React, { useState } from 'react';
import { Play, CheckCircle2, AlertCircle, Loader2, Sparkles, X, ArrowRight } from 'lucide-react';
import { runRecoveryDemo, DemoStepUpdate } from '../../services/dashboardApi';

interface RunRecoveryDemoProps {
  onSuccess?: (recoveredAmount: number, caseId: string) => void;
}

export const RunRecoveryDemo: React.FC<RunRecoveryDemoProps> = ({ onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<DemoStepUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recoveredAmount: number; caseId: string; txRef: string } | null>(null);

  const initialStepsList: DemoStepUpdate[] = [
    { step: 'create_payment', label: 'Creating failed payment...', status: 'pending' },
    { step: 'ai_analysis', label: 'AI analyzing recovery case...', status: 'pending' },
    { step: 'xgb_prediction', label: 'Calculating recovery probability...', status: 'pending' },
    { step: 'shap_explanation', label: 'Generating SHAP explanation...', status: 'pending' },
    { step: 'intervention', label: 'Selecting intervention & root cause...', status: 'pending' },
    { step: 'guardrails', label: 'Applying safety guardrails...', status: 'pending' },
    { step: 'execute_recovery', label: 'Executing simulated recovery...', status: 'pending' }
  ];

  const handleStartDemo = async () => {
    setIsModalOpen(true);
    setIsRunning(true);
    setError(null);
    setResult(null);
    setSteps(initialStepsList);

    try {
      const demoResult = await runRecoveryDemo(update => {
        setSteps(prevSteps =>
          prevSteps.map(s => (s.step === update.step ? { ...s, ...update } : s))
        );
      });

      setResult({
        recoveredAmount: demoResult.recoveredAmount,
        caseId: demoResult.caseId,
        txRef: demoResult.transactionReference
      });
      setIsRunning(false);

      if (onSuccess) {
        onSuccess(demoResult.recoveredAmount, demoResult.caseId);
      }
    } catch (err: any) {
      setError(err.message || 'Recovery demo execution failed.');
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      setIsModalOpen(false);
    }
  };

  return (
    <>
      {/* Hero Action Button */}
      <button
        onClick={handleStartDemo}
        className="group relative inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white font-bold text-sm tracking-wide shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
        <span>Run Recovery Demo</span>
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        </div>
      </button>

      {/* Progress Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-md animate-fade-in-up">
          <div className="glass-card w-full max-w-lg p-6 sm:p-8 relative border border-indigo-500/30 shadow-2xl">
            {/* Close Button */}
            {!isRunning && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-surface-200/60 hover:text-surface-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Modal Title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-surface-100">Live AI Recovery Workflow</h3>
                <p className="text-xs text-surface-200/50">Module 7 automated payment recovery simulation</p>
              </div>
            </div>

            {/* Steps Progress List */}
            <div className="space-y-3 mb-6 bg-surface-900/60 p-4 rounded-xl border border-white/5 max-h-[300px] overflow-y-auto">
              {steps.map((st, index) => (
                <div key={st.step} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center shrink-0 font-mono text-[11px]">
                      {st.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : st.status === 'failed' ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : st.status === 'in_progress' ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : (
                        <span className="text-surface-200/30">{index + 1}</span>
                      )}
                    </div>
                    <span
                      className={`font-medium ${
                        st.status === 'completed'
                          ? 'text-surface-100'
                          : st.status === 'in_progress'
                          ? 'text-indigo-300 font-bold'
                          : st.status === 'failed'
                          ? 'text-rose-300'
                          : 'text-surface-200/40'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <p className="font-bold">Recovery Demo Failed</p>
                  <p className="opacity-80">{error}</p>
                </div>
              </div>
            )}

            {/* Success Card */}
            {result && (
              <div className="p-5 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2 animate-fade-in-up">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-extrabold text-emerald-300">Recovery Successful</h4>
                <p className="text-2xl font-black text-white">
                  ₹{result.recoveredAmount.toLocaleString()} Recovered
                </p>
                <p className="text-xs text-emerald-200/60 font-mono">
                  Ref: {result.txRef}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              {!isRunning && (
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2"
                >
                  <span>Close</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RunRecoveryDemo;
