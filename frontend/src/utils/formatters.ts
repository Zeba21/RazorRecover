/**
 * Formatting utility to strip out "Module X" / "MODULE X" patterns
 * (e.g., "MODULE 5", "Module 8", "Module 5 SHAP Attribution", "MODULE 5: ")
 * completely from user interface strings and feature names.
 */

export function stripModuleText(text: string | null | undefined): string {
  if (!text) return '';

  return text
    // Match [Module 5], (Module 5), Module 5 —, MODULE 5:, Module 5, etc.
    .replace(/[\(\[]?\bMODULE\s*\d+\b[\)\]]?\s*[-:—]?\s*/gi, '')
    .replace(/\s*[-:—]?\s*[\(\[]?\bMODULE\s*\d+\b[\)\]]?/gi, '')
    .trim();
}

/**
 * Formats feature names by removing any 'Module X' prefix/suffix before rendering in UI.
 */
export function formatFeatureName(feature: string | null | undefined): string {
  return stripModuleText(feature);
}
