import {
  LayoutDashboard,
  Activity,
  CreditCard,
  Brain,
  Settings,
  Shield,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: CreditCard, label: 'Payments' },
  { icon: Brain, label: 'AI Agent' },
  { icon: Activity, label: 'Recovery' },
  { icon: Shield, label: 'Guardrails' },
  { icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-20 lg:w-64 glass-card rounded-none border-r border-brand-500/10 flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-lg font-bold gradient-text leading-tight">RazorRecover</h1>
          <p className="text-xs text-surface-200/50">AI Revenue Recovery</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            id={`nav-${label.toLowerCase()}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
              ${
                active
                  ? 'bg-brand-600/20 text-brand-300 shadow-lg shadow-brand-500/10'
                  : 'text-surface-200/60 hover:bg-white/5 hover:text-surface-100'
              }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/5 hidden lg:block">
        <p className="text-[10px] text-surface-200/30 text-center">Module 1 — Foundation</p>
      </div>
    </aside>
  );
}
