"""
Synthetic Dataset Generator for Payment Recovery Prediction (Module 4)

Generates realistic failed payment recovery dataset with 13 features:
1. transaction_amount
2. customer_payment_history
3. previous_success_rate
4. previous_failure_count
5. failure_type
6. retry_count
7. customer_age_days
8. subscription_status
9. time_since_failure
10. payment_method
11. customer_segment
12. invoice_age
13. previous_recovery_success

Target:
recovered (0 or 1)

Assumptions & Leakage Prevention:
- `previous_recovery_success` represents ONLY historical recovery events that occurred PRIOR to the current payment failure.
- Features reflect state at prediction time (no future data, no actual recovery timestamp).
"""

import numpy as np
import pandas as pd
from pathlib import Path


def generate_synthetic_recovery_data(n_samples: int = 12000, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a realistic synthetic dataset for payment recovery probability modeling.
    """
    np.random.seed(random_state)

    # 1. Feature distributions
    transaction_amount = np.random.exponential(scale=5000, size=n_samples) + 200
    transaction_amount = np.clip(transaction_amount, 200, 150000).round(2)

    customer_payment_history = np.random.geometric(p=0.1, size=n_samples) - 1
    customer_payment_history = np.clip(customer_payment_history, 0, 100)

    previous_success_rate = np.random.beta(a=5, b=2, size=n_samples).round(4)

    previous_failure_count = np.random.poisson(lam=1.5, size=n_samples)
    previous_failure_count = np.clip(previous_failure_count, 0, 30)

    failure_types = ['insufficient_funds', 'authentication_failed', 'gateway_timeout', 'card_expired', 'network_error']
    failure_type_probs = [0.45, 0.20, 0.15, 0.10, 0.10]
    failure_type = np.random.choice(failure_types, size=n_samples, p=failure_type_probs)

    retry_count = np.random.choice([0, 1, 2, 3, 4, 5], size=n_samples, p=[0.4, 0.3, 0.15, 0.08, 0.05, 0.02])

    customer_age_days = np.random.exponential(scale=250, size=n_samples) + 1
    customer_age_days = np.clip(customer_age_days, 1, 1500).astype(int)

    subscription_statuses = ['active', 'past_due', 'trialing', 'canceled', 'unpaid', 'paused']
    sub_probs = [0.60, 0.15, 0.10, 0.08, 0.04, 0.03]
    subscription_status = np.random.choice(subscription_statuses, size=n_samples, p=sub_probs)

    time_since_failure = np.random.exponential(scale=4, size=n_samples).round(1)
    time_since_failure = np.clip(time_since_failure, 0.1, 45.0)

    payment_methods = ['card', 'upi', 'netbanking', 'wallet']
    pm_probs = [0.40, 0.40, 0.12, 0.08]
    payment_method = np.random.choice(payment_methods, size=n_samples, p=pm_probs)

    customer_segments = ['regular', 'enterprise', 'vip', 'starter']
    seg_probs = [0.55, 0.20, 0.10, 0.15]
    customer_segment = np.random.choice(customer_segments, size=n_samples, p=seg_probs)

    invoice_age = np.random.exponential(scale=5, size=n_samples).round(1)
    invoice_age = np.clip(invoice_age, 0.0, 60.0)

    # Historical prior recovery success (0 or 1)
    previous_recovery_success = np.random.binomial(n=1, p=0.45, size=n_samples)

    # 2. Domain-driven Logit calculation for target recovery probability
    # Base intercept
    logit = 0.2

    # Positive contributions
    logit += 2.2 * previous_success_rate
    logit += 0.8 * previous_recovery_success
    logit += 0.025 * np.minimum(customer_payment_history, 30)
    logit += 0.0008 * np.minimum(customer_age_days, 500)

    # Status / Segment / Method effects
    sub_effect = {'active': 0.7, 'trialing': 0.4, 'past_due': -0.4, 'paused': -0.2, 'unpaid': -0.9, 'canceled': -1.6}
    logit += np.array([sub_effect[s] for s in subscription_status])

    seg_effect = {'enterprise': 0.8, 'vip': 0.6, 'regular': 0.1, 'starter': -0.3}
    logit += np.array([seg_effect[s] for s in customer_segment])

    pm_effect = {'upi': 0.4, 'netbanking': 0.2, 'card': 0.0, 'wallet': -0.1}
    logit += np.array([pm_effect[m] for m in payment_method])

    ft_effect = {
        'gateway_timeout': 0.6,
        'network_error': 0.5,
        'authentication_failed': -0.1,
        'insufficient_funds': -0.4,
        'card_expired': -1.2
    }
    logit += np.array([ft_effect[f] for f in failure_type])

    # Negative impacts
    logit -= 0.12 * previous_failure_count
    logit -= 0.35 * retry_count
    logit -= 0.06 * time_since_failure
    logit -= 0.04 * invoice_age

    # Controlled random noise so model cannot trivially memorize target
    noise = np.random.normal(loc=0.0, scale=0.75, size=n_samples)
    logit += noise

    # Convert logit to probability via sigmoid function
    prob = 1.0 / (1.0 + np.exp(-logit))

    # Binary outcome via Bernoulli sampling
    recovered = np.random.binomial(n=1, p=prob)

    df = pd.DataFrame({
        'transaction_amount': transaction_amount,
        'customer_payment_history': customer_payment_history,
        'previous_success_rate': previous_success_rate,
        'previous_failure_count': previous_failure_count,
        'failure_type': failure_type,
        'retry_count': retry_count,
        'customer_age_days': customer_age_days,
        'subscription_status': subscription_status,
        'time_since_failure': time_since_failure,
        'payment_method': payment_method,
        'customer_segment': customer_segment,
        'invoice_age': invoice_age,
        'previous_recovery_success': previous_recovery_success,
        'recovered': recovered
    })

    return df


if __name__ == "__main__":
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)
    csv_path = out_dir / "synthetic_recovery_data.csv"
    
    df = generate_synthetic_recovery_data(n_samples=12000, random_state=42)
    df.to_csv(csv_path, index=False)
    print(f"[SUCCESS] Generated {len(df)} synthetic samples at: {csv_path}")
    print("Class balance (recovered):")
    print(df['recovered'].value_counts(normalize=True))
