import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/Dashboard';
import RecoveryCaseDetailPage from './pages/RecoveryCaseDetail';

function App() {
  const [route, setRoute] = useState<'dashboard' | 'cases' | string>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('/dashboard/cases/')) {
        const id = hash.replace('/dashboard/cases/', '');
        setSelectedCaseId(id);
        setRoute('case_detail');
      } else if (hash === '/dashboard/cases') {
        setRoute('cases');
        setSelectedCaseId(null);
      } else {
        setRoute('dashboard');
        setSelectedCaseId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (newRoute: 'dashboard' | 'cases') => {
    if (newRoute === 'cases') {
      window.location.hash = '/dashboard/cases';
      setRoute('cases');
      setSelectedCaseId(null);
    } else {
      window.location.hash = '/dashboard';
      setRoute('dashboard');
      setSelectedCaseId(null);
    }
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setRoute('case_detail');
    window.location.hash = `/dashboard/cases/${caseId}`;
  };

  return (
    <div className="flex min-h-screen bg-surface-950 text-surface-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <Sidebar currentRoute={route} onNavigate={navigateTo} />

      {/* Main Content Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 ml-20 lg:ml-64 max-w-7xl mx-auto w-full">
        {route === 'case_detail' && selectedCaseId ? (
          <RecoveryCaseDetailPage
            caseId={selectedCaseId}
            onBack={() => navigateTo('dashboard')}
          />
        ) : (
          <DashboardPage onSelectCase={handleSelectCase} />
        )}
      </main>
    </div>
  );
}

export default App;
