import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  variant?: 'primary' | 'success' | 'warning' | 'info';
  loading?: boolean;
  error?: string | null;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  variant = 'primary',
  loading = false,
  error = null
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accent: 'from-emerald-500/20 to-transparent',
          valueColor: 'text-emerald-300'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          accent: 'from-amber-500/20 to-transparent',
          valueColor: 'text-amber-300'
        };
      case 'info':
        return {
          iconBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          accent: 'from-sky-500/20 to-transparent',
          valueColor: 'text-sky-300'
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          accent: 'from-indigo-500/20 to-transparent',
          valueColor: 'text-indigo-200'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="relative glass-card p-6 overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 group">
      {/* Background Subtle Gradient Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${styles.accent} rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity`} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-200/60 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-28 bg-white/10 rounded animate-pulse my-1" />
          ) : error ? (
            <p className="text-xs text-rose-400 font-medium">Unable to load data</p>
          ) : (
            <p className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${styles.valueColor}`}>
              {value}
            </p>
          )}
        </div>

        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${styles.iconBg} shadow-inner`}>
          <Icon className="w-5.5 h-5.5" />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        {loading ? (
          <div className="h-3 w-36 bg-white/5 rounded animate-pulse" />
        ) : (
          <p className="text-xs text-surface-200/50">{description}</p>
        )}
      </div>
    </div>
  );
};

export default KPICard;
