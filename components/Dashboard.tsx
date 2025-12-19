import React, { useState, useEffect } from 'react';
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
  // Default to Light Mode as per user request
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(true);
  
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync Theme with DOM
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Initial Store Loading
  useEffect(() => {
    const init = async () => {
      const stores = await getStores();
      let available = stores;
      // Filter based on user permissions
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
    try {
      const result = await fetchDashboardData(selectedStore, new Date(fromDate), new Date(toDate), !desiredLiveMode);
      setData(result);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore && view !== 'SETTINGS') loadData();
  }, [selectedStore, view]);

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
            onRefresh={loadData}
            onMainExport={handleMainExport}
            dataAvailable={!!data}
          />
        )}

        {errorMsg && (
          <div className="mx-8 mt-4 bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-medium">
            {errorMsg}
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