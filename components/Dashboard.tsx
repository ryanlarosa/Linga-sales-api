
import React, { useState, useEffect, useRef } from 'react';
import { User, FetchedData, Store } from '../types';
import { fetchDashboardData } from '../services/api';
import { getStores } from '../services/firestoreService';
import { exportToExcel } from '../services/excelService';

import Sidebar from './Dashboard/Sidebar';
import DashboardHeader from './Dashboard/DashboardHeader';
import DashboardFilters from './Dashboard/DashboardFilters';
import OverviewModule from './Dashboard/OverviewModule';
import ReportsModule from './Dashboard/ReportsModule';
import SettingsModule from './Dashboard/SettingsModule';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type ViewMode = 'OVERVIEW' | 'REPORTS' | 'SETTINGS';

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [view, setView] = useState<ViewMode>('OVERVIEW');
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(true);
  
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Initial Load: Store List only
  useEffect(() => {
    const init = async () => {
      const stores = await getStores();
      let available = stores;
      if (user.role === 'user' && user.allowedStores && user.allowedStores.length > 0) {
          available = stores.filter(s => user.allowedStores!.includes(s.id));
      }
      setStoreList(available);
      if (available.length > 0 && !selectedStore) setSelectedStore(available[0].id);
    };
    init();
  }, [user]);

  const loadData = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    setErrorMsg(null);
    setSyncProgress("Initializing...");
    try {
      const result = await fetchDashboardData(
        selectedStore, 
        new Date(fromDate), 
        new Date(toDate), 
        !desiredLiveMode,
        (msg) => setSyncProgress(msg)
      );
      setData(result);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
      setSyncProgress("");
    }
  };

  const handleMainExport = () => {
    if (!data) return;
    const storeName = storeList.find(s => s.id === selectedStore)?.name || "Store";
    exportToExcel(data, storeName);
  };

  const currentStoreName = storeList.find(s => s.id === selectedStore)?.name || "Store";
  const title = view === 'OVERVIEW' ? 'Analytics Overview' : view === 'REPORTS' ? 'Reports & Recap' : 'System Configuration';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <Sidebar user={user} view={view} setView={setView} onLogout={onLogout} />

      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <DashboardHeader 
          title={title} 
          isSimulated={!!data?.isSimulated} 
          theme={theme} 
          setTheme={setTheme} 
          desiredLiveMode={desiredLiveMode} 
          setDesiredLiveMode={setDesiredLiveMode} 
          onRefresh={loadData} 
        />

        {view !== 'SETTINGS' && (
          <DashboardFilters 
            storeList={storeList}
            selectedStore={selectedStore}
            setSelectedStore={setSelectedStore}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            loading={loading}
            syncProgress={syncProgress}
            onRefresh={loadData}
            onMainExport={handleMainExport}
            dataAvailable={!!data}
          />
        )}

        {errorMsg && (
          <div className="mx-8 mt-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 px-6 py-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-fadeIn">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <p className="uppercase tracking-widest text-[10px] opacity-70 mb-1">Synchronization Halted</p>
              {errorMsg}
            </div>
          </div>
        )}

        <div className="pb-8">
          {view === 'OVERVIEW' && <OverviewModule data={data} theme={theme} loading={loading} />}
          {view === 'REPORTS' && (
            <ReportsModule 
              data={data} 
              fromDate={fromDate} 
              toDate={toDate} 
              selectedStoreName={currentStoreName} 
            />
          )}
          {view === 'SETTINGS' && <SettingsModule currentUser={user} />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
