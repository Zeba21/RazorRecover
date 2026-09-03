import React from 'react';
import { LayoutDashboard, CreditCard, Shield, FileText, BarChart3, Brain } from 'lucide-react';

export type RouteType = 'dashboard' | 'cases' | 'audit' | 'analytics' | 'model-evaluation' | string;

interface SidebarProps {
  currentRoute: RouteType;
  onNavigate: (route: RouteType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cases', label: 'Recovery Cases', icon: CreditCard },
    { id: 'audit', label: 'Audit Explorer', icon: FileText },
    { id: 'analytics', label: 'Recovery Analytics', icon: BarChart3 },
    { id: 'model-evaluation', label: 'Model Evaluation', icon: Brain }
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-20 lg:w-64 glass-card rounded-none border-r border-indigo-500/15 flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
          <Shield className="w-5.5 h-5.5 text-white" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-lg font-bold gradient-text leading-tight">RazorRecover</h1>
          <p className="text-[11px] text-surface-200/50">AI Revenue Recovery</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentRoute === id || (id === 'cases' && currentRoute.startsWith('cases'));
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                  : 'text-surface-200/60 hover:bg-white/5 hover:text-surface-100'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 hidden lg:block">
        <p className="text-[10px] text-surface-200/30 text-center font-mono">Module 9 — Safety, Audit & Evaluation</p>
      </div>
    </aside>
  );
};

export default Sidebar;
