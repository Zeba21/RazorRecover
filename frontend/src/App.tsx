import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
  responseTime: string;
  services: {
    database: { status: string; error?: string };
    aiService: { status: string; url: string; error?: string };
  };
  environment: string;
}

function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      if (json.success) {
        setHealth(json.data);
      } else {
        setError('Health check returned failure');
      }
    } catch (err) {
      setError('Could not reach backend — is it running on :5000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-10 ml-20 lg:ml-64">
        <Dashboard health={health} loading={loading} error={error} onRefresh={fetchHealth} />
      </main>
    </div>
  );
}

export default App;
