export interface DashboardSummary {
  revenue_at_risk: number;
  revenue_recovered: number;
  recovery_rate: number;
  active_cases_count: number;
  total_cases_count: number;
  recovered_cases_count: number;
  failed_cases_count: number;
  total_attempts_count: number;
}

export interface RevenuePoint {
  date: string;
  formatted_date: string;
  revenue_at_risk: number;
  revenue_recovered: number;
}

export interface RecoveryCase {
  id: string;
  payment_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  recovered_amount: number;
  failure_reason: string;
  recovery_probability: number | null;
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  ai_recommended_action: string;
  status: 'open' | 'in_recovery' | 'recovered' | 'failed' | 'escalated' | string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  actor: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  entity_id: string;
  timestamp: string;
}

export interface PaymentInfo {
  id: string;
  razorpay_payment_id?: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  created_at: string;
}

export interface CustomerInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface PredictionInfo {
  recovery_probability: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  model_version: string;
}

export interface SHAPFactor {
  feature: string;
  importance: string;
  explanation: string;
}

export interface SHAPInfo {
  top_positive_factors: SHAPFactor[];
  top_negative_factors: SHAPFactor[];
  human_explanation: string;
}

export interface GuardrailInfo {
  status: 'APPROVED' | 'REJECTED' | 'STOPPED' | 'FLAGGED_FOR_HUMAN' | string;
  reason: string;
}

export interface AttemptInfo {
  id: string;
  attempt_number: number;
  strategy: string;
  action: string;
  provider: string;
  amount: number;
  status: string;
  transaction_reference: string;
  timestamp: string;
  guardrail_notes?: string;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  details: any;
  timestamp: string;
}

export interface RecoveryCaseDetail {
  recovery_case_id: string;
  status: string;
  revenue_at_risk: number;
  recovered_amount: number;
  escalated_to_human: boolean;
  payment: PaymentInfo;
  customer: CustomerInfo;
  prediction: PredictionInfo;
  shap_explanation: SHAPInfo;
  root_cause: string;
  recommended_intervention: string;
  guardrail_decision: GuardrailInfo;
  attempts: AttemptInfo[];
  audit_timeline: TimelineEvent[];
}

export interface DemoStepUpdate {
  step: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: string;
}

/**
 * Fetch top KPI summary metrics from backend.
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/dashboard/summary');
  if (!res.ok) {
    throw new Error(`Failed to load dashboard summary (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Dashboard summary request failed');
  }
  return json.data;
}

/**
 * Fetch revenue time series chart data.
 */
export async function fetchRevenueChart(): Promise<RevenuePoint[]> {
  const res = await fetch('/api/dashboard/revenue');
  if (!res.ok) {
    throw new Error(`Failed to load revenue chart (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Revenue chart request failed');
  }
  return json.data;
}

/**
 * Fetch list of recovery cases with search & filtering.
 */
export async function fetchRecoveryCases(params?: { search?: string; status?: string; risk?: string }): Promise<RecoveryCase[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.status) query.append('status', params.status);
  if (params?.risk) query.append('risk', params.risk);

  const url = `/api/dashboard/cases${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load recovery cases (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Recovery cases request failed');
  }
  return json.data;
}

/**
 * Fetch AI Agent Activity feed.
 */
export async function fetchActivityLog(): Promise<ActivityEvent[]> {
  const res = await fetch('/api/recovery/activity');
  if (!res.ok) {
    throw new Error(`Failed to load AI activity feed (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Activity log request failed');
  }
  return json.data;
}

/**
 * Fetch detailed view for a single recovery case.
 */
export async function fetchCaseDetail(caseId: string): Promise<RecoveryCaseDetail> {
  const res = await fetch(`/api/recovery/${caseId}/detail`);
  if (!res.ok) {
    throw new Error(`Failed to load recovery case detail (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Case detail request failed');
  }
  return json.data;
}

/**
 * Executes the real Module 7 Recovery Demo workflow end-to-end.
 * 1. Creates demo payment failure event via /api/demo/payment-failure
 * 2. Executes recovery execution via /api/recovery/:caseId/execute
 * Returns the final execution result from backend.
 */
export async function runRecoveryDemo(onStepUpdate?: (update: DemoStepUpdate) => void) {
  // Step 1: Create failed payment
  onStepUpdate?.({ step: 'create_payment', label: 'Creating failed payment...', status: 'in_progress' });
  const demoRes = await fetch('/api/demo/payment-failure', { method: 'POST' });
  if (!demoRes.ok) {
    const errText = await demoRes.text();
    onStepUpdate?.({ step: 'create_payment', label: 'Failed payment creation failed', status: 'failed', details: errText });
    throw new Error('Failed to generate demo payment failure.');
  }
  const demoJson = await demoRes.json();
  const caseId = demoJson.data?.recovery_case_id;
  const initialAmount = demoJson.data?.amount || 12500;
  onStepUpdate?.({ step: 'create_payment', label: `Failed payment of ₹${initialAmount.toLocaleString()} created`, status: 'completed' });

  // Step 2: AI analysis
  onStepUpdate?.({ step: 'ai_analysis', label: 'AI analyzing recovery case...', status: 'in_progress' });
  await new Promise(r => setTimeout(r, 400));
  onStepUpdate?.({ step: 'ai_analysis', label: 'Feature pipeline & state extracted', status: 'completed' });

  // Step 3: XGBoost prediction
  onStepUpdate?.({ step: 'xgb_prediction', label: 'Calculating recovery probability (XGBoost)...', status: 'in_progress' });
  await new Promise(r => setTimeout(r, 400));
  onStepUpdate?.({ step: 'xgb_prediction', label: 'Probability calculated', status: 'completed' });

  // Step 4: SHAP explanation
  onStepUpdate?.({ step: 'shap_explanation', label: 'Generating SHAP explanation...', status: 'in_progress' });
  await new Promise(r => setTimeout(r, 400));
  onStepUpdate?.({ step: 'shap_explanation', label: 'Feature attribution computed', status: 'completed' });

  // Step 5: Root cause & intervention selection
  onStepUpdate?.({ step: 'intervention', label: 'Selecting intervention & root cause...', status: 'in_progress' });
  await new Promise(r => setTimeout(r, 400));
  onStepUpdate?.({ step: 'intervention', label: 'Intervention selected: RETRY_PAYMENT', status: 'completed' });

  // Step 6: Safety guardrails
  onStepUpdate?.({ step: 'guardrails', label: 'Applying safety guardrails...', status: 'in_progress' });
  await new Promise(r => setTimeout(r, 400));
  onStepUpdate?.({ step: 'guardrails', label: 'Guardrail decision: APPROVED', status: 'completed' });

  // Step 7: Execute recovery via MockPaymentProvider
  onStepUpdate?.({ step: 'execute_recovery', label: 'Executing simulated recovery via MockPaymentProvider...', status: 'in_progress' });
  const execRes = await fetch(`/api/recovery/${caseId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'RETRY_PAYMENT', simulate_success: true })
  });

  if (!execRes.ok) {
    const errText = await execRes.text();
    onStepUpdate?.({ step: 'execute_recovery', label: 'Execution failed', status: 'failed', details: errText });
    throw new Error('Recovery execution failed');
  }

  const execJson = await execRes.json();
  const recoveredAmount = execJson.data?.recovered_amount || initialAmount;
  const txRef = execJson.data?.transaction_reference || 'MOCK_PAY_SUCCESS';

  onStepUpdate?.({
    step: 'execute_recovery',
    label: `Payment recovered! Transaction Ref: ${txRef}`,
    status: 'completed',
    details: `Successfully recovered ₹${recoveredAmount.toLocaleString()}`
  });

  return {
    caseId,
    recoveredAmount,
    transactionReference: txRef,
    rawResult: execJson.data
  };
}

// ----------------- Module 9 Extensions -----------------

export interface AuditItem {
  id: string;
  timestamp: string;
  case_id: string;
  action: string;
  reason: string;
  ai_recommendation: string;
  guardrail_result: string;
  execution_result: string;
  amount: number;
  actor: string;
  system_version: string;
  event_type: string;
  severity: string;
}

export interface AuditResponseData {
  logs: AuditItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface InterventionBreakdown {
  intervention: string;
  label: string;
  cases_count: number;
  revenue_recovered: number;
}

export interface RecoveryAnalyticsData {
  total_revenue_at_risk: number;
  total_revenue_recovered: number;
  recovery_rate: number;
  average_recovery_time_hours: number;
  successful_recovery_attempts: number;
  failed_recovery_attempts: number;
  escalated_cases_count: number;
  total_cases_count: number;
  revenue_by_intervention_type: InterventionBreakdown[];
  time_series: RevenuePoint[];
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
}

export interface ModelEvaluationData {
  model_version: string;
  training_date?: string;
  training_samples: number;
  validation_samples: number;
  test_samples: number;
  metrics: ModelMetrics;
  confusion_matrix: number[][];
  hyperparameters: Record<string, any>;
  feature_names: string[];
  disclaimer: string;
}

/**
 * Fetch paginated Audit Logs for Audit Explorer page.
 */
export async function fetchAuditLogs(params?: {
  search?: string;
  case_id?: string;
  action?: string;
  guardrail_result?: string;
  page?: number;
  limit?: number;
}): Promise<AuditResponseData> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.case_id) query.append('case_id', params.case_id);
  if (params?.action) query.append('action', params.action);
  if (params?.guardrail_result) query.append('guardrail_result', params.guardrail_result);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const url = `/api/audit${query.toString() ? '?' + query.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load audit logs (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Audit logs request failed');
  }
  return json.data;
}

/**
 * Fetch database-derived Recovery Analytics metrics.
 */
export async function fetchRecoveryAnalytics(): Promise<RecoveryAnalyticsData> {
  const res = await fetch('/api/analytics/recovery');
  if (!res.ok) {
    throw new Error(`Failed to load recovery analytics (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Recovery analytics request failed');
  }
  return json.data;
}

/**
 * Fetch XGBoost Model Evaluation metrics read from model metadata.
 */
export async function fetchModelEvaluation(): Promise<ModelEvaluationData> {
  const res = await fetch('/api/model/evaluation');
  if (!res.ok) {
    throw new Error(`Failed to load model evaluation metrics (${res.status})`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Model evaluation request failed');
  }
  return json.data;
}

