"""
SHAP Explanation Module (Module 5)

Generates human-readable SHAP feature explanations for XGBoost recovery predictions.
Uses the persisted Module 4 joblib model artifact without retraining.
"""

import shap
import numpy as np
import pandas as pd

# Mapping of raw feature names to human-friendly display titles
FEATURE_DISPLAY_NAMES = {
    'previous_success_rate': 'Previous payment success rate',
    'customer_payment_history': 'Customer payment history',
    'previous_recovery_success': 'Prior recovery history',
    'retry_count': 'Retry attempts',
    'failure_type': 'Failure category',
    'subscription_status': 'Subscription status',
    'customer_segment': 'Customer tier',
    'payment_method': 'Payment method',
    'previous_failure_count': 'Previous failure count',
    'time_since_failure': 'Time elapsed since failure',
    'invoice_age': 'Invoice age',
    'customer_age_days': 'Customer account age',
    'transaction_amount': 'Transaction amount',
}

# Categorical features list
CATEGORICAL_FEATURES = [
    'failure_type',
    'subscription_status',
    'payment_method',
    'customer_segment',
]


def map_feature_to_explanation(feat: str, value: any, is_positive: bool) -> str:
    """
    Generates a clear, non-technical explanation string for a given feature and impact direction.
    """
    if feat == 'previous_success_rate':
        try:
            val_pct = f"{float(value) * 100:.0f}%"
        except (ValueError, TypeError):
            val_pct = str(value)
        return f"Strong previous payment success rate ({val_pct})" if is_positive else f"Low historical payment success rate ({val_pct})"

    elif feat == 'customer_payment_history':
        return f"Solid payment history with {value} past successful payments" if is_positive else f"Limited payment history ({value} past payments)"

    elif feat == 'previous_recovery_success':
        return "Previous payments for this customer have been successfully recovered" if is_positive else "No successful prior payment recoveries recorded"

    elif feat == 'retry_count':
        return f"Low number of previous retries ({value})" if is_positive else f"Multiple retries ({value}) have already failed"

    elif feat == 'failure_type':
        return f"The failure reason ({value}) appears temporary" if is_positive else f"The failure reason ({value}) reduces recovery probability"

    elif feat == 'subscription_status':
        return f"Active subscription status ({value})" if is_positive else f"Subscription status ({value}) indicates payment risk"

    elif feat == 'customer_segment':
        return f"High-value customer tier ({value})" if is_positive else f"Customer tier ({value}) has lower historical recovery rates"

    elif feat == 'payment_method':
        return f"Payment method ({value}) supports seamless retry" if is_positive else f"Payment method ({value}) has lower recovery success rate"

    elif feat == 'previous_failure_count':
        return f"Low count of past payment failures ({value})" if is_positive else f"Several previous payment failures ({value})"

    elif feat == 'time_since_failure':
        return f"The payment failure is recent ({value} days ago)" if is_positive else f"Failure occurred {value} days ago with delayed action"

    elif feat == 'invoice_age':
        return f"Invoice is recent ({value} days old)" if is_positive else f"Invoice has been overdue for a longer period ({value} days)"

    elif feat == 'customer_age_days':
        return f"Long-standing customer account ({value} days active)" if is_positive else f"New customer account ({value} days active)"

    elif feat == 'transaction_amount':
        try:
            amt = f"₹{float(value):,.2f}"
        except (ValueError, TypeError):
            amt = f"₹{value}"
        return f"Manageable transaction amount ({amt})" if is_positive else f"Higher transaction amount ({amt})"

    else:
        return f"Feature '{feat}' with value '{value}' impacted prediction"


def get_importance_level(abs_shap: float) -> str:
    """
    Categorizes SHAP magnitude into deterministic importance levels:
    - abs_shap >= 0.30 -> HIGH
    - 0.10 <= abs_shap < 0.30 -> MEDIUM
    - abs_shap < 0.10 -> LOW
    """
    if abs_shap >= 0.30:
        return "HIGH"
    elif abs_shap >= 0.10:
        return "MEDIUM"
    else:
        return "LOW"


def generate_shap_explanation(pipeline, input_df: pd.DataFrame) -> dict:
    """
    Computes SHAP explanations for a single prediction row using TreeExplainer.
    Aggregates one-hot encoded features back to raw features and ranks top positive & negative factors.
    Returns human-readable structured dictionary.
    """
    preprocessor = pipeline.named_steps['preprocessor']
    xgb_classifier = pipeline.named_steps['classifier']

    # Preprocess raw input row
    X_trans = preprocessor.transform(input_df)
    feature_names_out = preprocessor.get_feature_names_out()

    # TreeExplainer on XGBClassifier
    explainer = shap.TreeExplainer(xgb_classifier)
    raw_shap_values = explainer.shap_values(X_trans)

    # Extract 1D array of SHAP values for single input sample
    if isinstance(raw_shap_values, list):
        shap_array = raw_shap_values[1][0] if len(raw_shap_values) > 1 else raw_shap_values[0][0]
    elif len(np.shape(raw_shap_values)) == 2:
        shap_array = raw_shap_values[0]
    elif len(np.shape(raw_shap_values)) == 3:
        shap_array = raw_shap_values[0][:, 1]
    else:
        shap_array = np.ravel(raw_shap_values)

    # Aggregate transformed column SHAP values back to raw 13 features
    feature_shap_map = {}
    row_dict = input_df.iloc[0].to_dict()

    for col_out, val in zip(feature_names_out, shap_array):
        clean = col_out.replace('num__', '').replace('cat__', '')
        base_feature = clean
        for cat_feat in CATEGORICAL_FEATURES:
            if clean.startswith(cat_feat + '_'):
                base_feature = cat_feat
                break

        feature_shap_map[base_feature] = feature_shap_map.get(base_feature, 0.0) + float(val)

    # Separate into positive & negative factors
    pos_factors = []
    neg_factors = []
    all_importances = []

    for feat, shap_val in feature_shap_map.items():
        abs_val = abs(shap_val)
        imp_level = get_importance_level(abs_val)
        is_pos = shap_val > 0
        feat_display = FEATURE_DISPLAY_NAMES.get(feat, feat)
        feat_val = row_dict.get(feat, '')
        explanation_text = map_feature_to_explanation(feat, feat_val, is_pos)

        item = {
            "feature": feat_display,
            "importance": imp_level,
            "explanation": explanation_text,
            "raw_feature": feat,
            "shap_value": shap_val,
            "abs_shap": abs_val
        }

        all_importances.append({
            "feature": feat_display,
            "importance": imp_level,
            "impact": "positive" if is_pos else "negative"
        })

        if shap_val > 0:
            pos_factors.append(item)
        elif shap_val < 0:
            neg_factors.append(item)

    # Rank factors by absolute SHAP contribution descending
    pos_factors.sort(key=lambda x: x["abs_shap"], reverse=True)
    neg_factors.sort(key=lambda x: x["abs_shap"], reverse=True)

    # Pick top 3 positive and top 3 negative
    top_pos = [
        {
            "feature": f["feature"],
            "importance": f["importance"],
            "explanation": f["explanation"]
        } for f in pos_factors[:3]
    ]

    top_neg = [
        {
            "feature": f["feature"],
            "importance": f["importance"],
            "explanation": f["explanation"]
        } for f in neg_factors[:3]
    ]

    # Generate human-readable narrative summary from actual top factors
    summary_parts = []

    if pos_factors and (not neg_factors or pos_factors[0]["abs_shap"] >= neg_factors[0]["abs_shap"]):
        top_p1 = pos_factors[0]
        summary_parts.append(top_p1["explanation"])
        if len(pos_factors) > 1:
            summary_parts.append(f"Additionally, {pos_factors[1]['explanation'].lower()}")
        if neg_factors:
            summary_parts.append(f"however, {neg_factors[0]['explanation'].lower()}")
    elif neg_factors:
        top_n1 = neg_factors[0]
        summary_parts.append(top_n1["explanation"])
        if len(neg_factors) > 1:
            summary_parts.append(f"Furthermore, {neg_factors[1]['explanation'].lower()}")
        if pos_factors:
            summary_parts.append(f"despite {pos_factors[0]['explanation'].lower()}")

    human_explanation = ". ".join([s.strip().capitalize() for s in summary_parts])
    if not human_explanation.endswith('.'):
        human_explanation += '.'

    return {
        "top_positive_factors": top_pos,
        "top_negative_factors": top_neg,
        "feature_importance": all_importances,
        "human_explanation": human_explanation
    }
