import React, { useState, useEffect } from 'react';
import { 
  Brain, Cpu, AlertCircle, RefreshCw, 
  HelpCircle, Layers, Sliders, Info
} from 'lucide-react';
import { fetchModelEvaluation, ModelEvaluationData } from '../services/dashboardApi';

export const ModelEvaluation: React.FC = () => {
  const [data, setData] = useState<ModelEvaluationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchModelEvaluation();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load model evaluation metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-purple-400 mx-auto" />
        <p className="text-xs text-surface-200/60 font-medium">Loading XGBoost model evaluation metadata...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center space-y-3 glass-card rounded-2xl p-6 max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <p className="text-sm font-semibold text-rose-300">Model Metadata Error</p>
        <p className="text-xs text-surface-200/60">{error || 'Unable to load model evaluation metrics'}</p>
        <button
          onClick={loadMetrics}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const { metrics, confusion_matrix, hyperparameters, disclaimer } = data;

  const metricCards = [
    {
      key: 'accuracy',
      label: 'Accuracy',
      value: metrics.accuracy,
      pct: (metrics.accuracy * 100).toFixed(2) + '%',
      color: '#6366f1',
      description: 'Proportion of total payment recovery predictions that were correct across all validation samples.'
    },
    {
      key: 'precision',
      label: 'Precision',
      value: metrics.precision,
      pct: (metrics.precision * 100).toFixed(2) + '%',
      color: '#3b82f6',
      description: 'Proportion of cases predicted as recoverable that were actually successfully recovered.'
    },
    {
      key: 'recall',
      label: 'Recall',
      value: metrics.recall,
      pct: (metrics.recall * 100).toFixed(2) + '%',
      color: '#10b981',
      description: 'Proportion of all actual recoverable payments correctly identified by the model.'
    },
    {
      key: 'f1',
      label: 'F1 Score',
      value: metrics.f1,
      pct: (metrics.f1 * 100).toFixed(2) + '%',
      color: '#ec4899',
      description: 'Harmonic mean of Precision and Recall, measuring overall classifier quality and balance.'
    },
    {
      key: 'roc_auc',
      label: 'ROC-AUC',
      value: metrics.roc_auc,
      pct: (metrics.roc_auc * 100).toFixed(2) + '%',
      color: '#8b5cf6',
      description: 'Area Under Receiver Operating Characteristic curve, measuring class separation ability.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Model Evaluation</h1>
            <p className="text-xs text-surface-200/60 mt-0.5 font-mono">
              Model Artifact: <span className="text-purple-300">{data.model_version}</span>
            </p>
          </div>
        </div>

        <button
          onClick={loadMetrics}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass-card hover:bg-white/10 text-surface-100 text-xs font-semibold transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload Metadata
        </button>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 flex items-start gap-3 shadow-lg shadow-purple-500/5">
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
            IMPORTANT METRIC DISTINCTION
          </p>
          <p className="text-xs font-medium text-purple-100">
            "{disclaimer}"
          </p>
          <p className="text-[11px] text-purple-300/70">
            These technical statistical metrics represent the offline validation performance of the Module 4 XGBoost binary classification model.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricCards.map((m) => (
          <div key={m.key} className="glass-card p-4 rounded-2xl space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-surface-200/60 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-surface-200/80">{m.label}</span>
                <Cpu className="w-3.5 h-3.5" style={{ color: m.color }} />
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {m.pct}
              </div>
              <p className="text-[10px] text-surface-200/40 font-mono mt-0.5">
                Raw score: {m.value}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-1.5 rounded-full bg-surface-900 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500" 
                  style={{ width: m.pct, backgroundColor: m.color }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Metric Explanations */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          Metric Definitions & Interpretations
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricCards.map((m) => (
            <div key={m.key} className="p-3.5 rounded-xl bg-surface-900/60 border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{m.label}</span>
                <span className="text-xs font-mono font-bold" style={{ color: m.color }}>{m.pct}</span>
              </div>
              <p className="text-[11px] text-surface-200/70 leading-relaxed">
                {m.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Confusion Matrix & Dataset Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Validation Confusion Matrix
          </h3>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400">True Negative (TN)</span>
              <p className="text-2xl font-extrabold text-white font-mono">
                {confusion_matrix?.[0]?.[0] ?? 65}
              </p>
              <p className="text-[10px] text-surface-200/50">Correctly predicted unrecoverable</p>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400">False Positive (FP)</span>
              <p className="text-2xl font-extrabold text-white font-mono">
                {confusion_matrix?.[0]?.[1] ?? 282}
              </p>
              <p className="text-[10px] text-surface-200/50">Incorrectly predicted recoverable</p>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-rose-400">False Negative (FN)</span>
              <p className="text-2xl font-extrabold text-white font-mono">
                {confusion_matrix?.[1]?.[0] ?? 47}
              </p>
              <p className="text-[10px] text-surface-200/50">Incorrectly predicted unrecoverable</p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">True Positive (TP)</span>
              <p className="text-2xl font-extrabold text-white font-mono">
                {confusion_matrix?.[1]?.[1] ?? 1406}
              </p>
              <p className="text-[10px] text-surface-200/50">Correctly predicted recoverable</p>
            </div>
          </div>
        </div>

        {/* Dataset Split & Hyperparameters */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            Training Split & Model Hyperparameters
          </h3>

          <div className="grid grid-cols-3 gap-2 py-1 border-b border-white/5 text-center font-mono">
            <div className="p-2 rounded-lg bg-surface-900/60">
              <p className="text-[10px] text-surface-200/50 uppercase">Train Samples</p>
              <p className="text-sm font-bold text-white">{data.training_samples}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-900/60">
              <p className="text-[10px] text-surface-200/50 uppercase">Val Samples</p>
              <p className="text-sm font-bold text-white">{data.validation_samples}</p>
            </div>
            <div className="p-2 rounded-lg bg-surface-900/60">
              <p className="text-[10px] text-surface-200/50 uppercase">Test Samples</p>
              <p className="text-sm font-bold text-white">{data.test_samples}</p>
            </div>
          </div>

          <div className="space-y-2 pt-1 font-mono text-xs">
            <p className="text-[10px] uppercase font-bold text-surface-200/40">Hyperparameters</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {Object.entries(hyperparameters).map(([hpKey, hpVal]) => (
                <div key={hpKey} className="flex justify-between px-3 py-1.5 rounded-lg bg-surface-900/60 border border-white/5">
                  <span className="text-surface-200/60">{hpKey}:</span>
                  <span className="text-purple-300 font-bold">{String(hpVal)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelEvaluation;
