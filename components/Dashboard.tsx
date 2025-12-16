import React, { useState, useEffect, useMemo } from 'react';
import { User, FetchedData, SaleOrder, MenuItemDetail, Store } from '../types';
import { fetchDashboardData } from '../services/api';
import { getStores } from '../services/firestoreService';
import { exportToExcel } from '../services/excelService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type ViewMode = 'OVERVIEW' | 'REPORTS' | 'SETTINGS';
type ReportTab = 'MENU' | 'DISCOUNTS' | 'STAFF';

// --- Icons ---
const IconSales = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconUsers = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const IconReceipt = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const IconChart = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const IconMenu = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const IconSettings = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`}></div>
);

// Helper to parse currency strings safely
const parseCurrency = (val: string | undefined): number => {
    if (!val) return 0;
    // Remove currency symbols or commas if present, though usually Linga sends clean strings or simple numbers
    return parseFloat(val.replace(/,/g, '').replace('$', '')) || 0;
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [view, setView] = useState<ViewMode>('OVERVIEW');
  const [reportTab, setReportTab] = useState<ReportTab>('MENU');
  
  // Store Management
  const [storeList, setStoreList] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  
  // Date & Config
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(true);
  
  // Data State
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Stores on Mount
  useEffect(() => {
    const initStores = async () => {
        const stores = await getStores();
        setStoreList(stores);
        
        // Determine available stores based on user role
        let available = stores;
        if (user.role !== 'admin' && user.allowedStores && user.allowedStores.length > 0) {
            available = stores.filter(s => user.allowedStores!.includes(s.id));
        }

        if (available.length > 0) {
            setSelectedStore(available[0].id);
        }
    };
    initStores();
  }, [user]);

  // 2. Fetch Dashboard Data when filters change
  const loadData = async () => {
    if (!selectedStore) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await fetchDashboardData(selectedStore, new Date(fromDate), new Date(toDate), !desiredLiveMode);
      setData(result);
      if (desiredLiveMode && result.isSimulated) {
        setErrorMsg("API Unreachable. Displaying cached/demo data.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load data");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
        loadData();
    }
  }, [selectedStore]);

  const handleUpdate = () => loadData();

  // Export Helper
  const handleExport = () => {
      if (!data) return;
      const storeName = storeList.find(s => s.id === selectedStore)?.name || "Unknown Store";
      exportToExcel(data, storeName);
  };

  // Filter available stores for dropdown
  const availableStores = useMemo(() => {
      if (user.role === 'admin' || !user.allowedStores || user.allowedStores.length === 0) {
          return storeList;
      }
      return storeList.filter(store => user.allowedStores?.includes(store.id));
  }, [storeList, user]);


  // --- KPI CALCULATIONS ---
  // Using data.sales directly to match Excel export and list view
  const { totalSales, totalGuests, avgTicket, salesByHour, chartData } = useMemo(() => {
    if (!data || !data.sales) {
        return { totalSales: "0.00", totalGuests: 0, avgTicket: "0.00", salesByHour: new Map(), chartData: [] };
    }

    let netSalesSum = 0;
    let guestCountSum = 0;
    const hourMap = new Map<string, number>();

    data.sales.forEach(sale => {
        // Linga API usually returns netSalesStr. If missing, we fallback to 0.
        // We sum individual tickets to ensure 100% accuracy with the table below.
        netSalesSum += parseCurrency(sale.netSalesStr);
        guestCountSum += sale.guestCount || 0;

        // Populate Chart Data from Sales directly
        if (sale.saleOpenTime) { // Format: "2023-10-27T14:30:00"
            const date = new Date(sale.saleOpenTime);
            if (!isNaN(date.getTime())) {
                const hour = date.getHours();
                const amt = parseCurrency(sale.netSalesStr);
                hourMap.set(String(hour), (hourMap.get(String(hour)) || 0) + amt);
            }
        }
    });

    // Avg Ticket
    const ticketCount = data.sales.length;
    const computedAvg = ticketCount > 0 ? (netSalesSum / ticketCount) : 0;

    // Chart Array
    const cData = [];
    for(let i=0; i<24; i++) {
        cData.push({
            time: `${i}:00`,
            netSales: hourMap.get(String(i)) || 0
        });
    }

    return {
        totalSales: netSalesSum.toFixed(2),
        totalGuests: guestCountSum,
        avgTicket: computedAvg.toFixed(2),
        salesByHour: hourMap,
        chartData: cData
    };
  }, [data]);

  // --- REPORT CALCULATIONS ---
  const menuPerformance = useMemo(() => {
     if(!data?.menus) return [];
     // Return raw menu data, assuming api returns sorted list or we sort by gross
     return [...data.menus].sort((a,b) => parseCurrency(b.totalGrossAmountStr) - parseCurrency(a.totalGrossAmountStr));
  }, [data]);

  const staffPerformance = useMemo(() => {
     if(!data?.sales) return [];
     const staffMap = new Map<string, {name: string, sales: number, count: number}>();
     
     data.sales.forEach(sale => {
         // Find employee name
         const employeeName = data.users.find(u => u.id === sale.employee)?.name || "Unknown";
         const amt = parseCurrency(sale.netSalesStr);
         
         const existing = staffMap.get(employeeName) || {name: employeeName, sales: 0, count: 0};
         existing.sales += amt;
         existing.count += 1;
         staffMap.set(employeeName, existing);
     });

     return Array.from(staffMap.values()).sort((a,b) => b.sales - a.sales);
  }, [data]);


  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col flex-shrink-0 z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-indigo-600/30">
             <span className="text-white font-bold text-lg">L</span>
           </div>
           <h1 className="text-lg font-bold text-white tracking-wide">LingaPOS</h1>
        </div>

        <div className="p-6">
            <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow ring-2 ring-slate-800">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{user.role === 'admin' ? 'Administrator' : 'Store User'}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
            <button 
                onClick={() => setView('OVERVIEW')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'OVERVIEW' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
                <IconChart />
                <span className="font-medium text-sm">Overview</span>
            </button>
            <button 
                onClick={() => setView('REPORTS')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'REPORTS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
                <IconMenu />
                <span className="font-medium text-sm">Sales Reports</span>
            </button>
            
            <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Settings</p>
            </div>
            
            <button 
                onClick={() => setView('SETTINGS')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'SETTINGS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
                <IconSettings />
                <span className="font-medium text-sm">Configuration</span>
            </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
            <button onClick={onLogout} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium w-full px-2 py-2">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-950">
        
        {/* Header */}
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-8 py-4 flex justify-between items-center h-20">
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                    {view === 'OVERVIEW' ? 'Analytics Overview' : view === 'REPORTS' ? 'Detailed Reports' : 'System Settings'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                     <span className={`w-2 h-2 rounded-full ${data?.isSimulated ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`}></span>
                     <p className="text-slate-400 text-xs font-medium">
                        {data?.isSimulated ? 'Offline / Demo Mode' : 'Live Data Stream'}
                     </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
                     <button onClick={() => {setDesiredLiveMode(true); handleUpdate();}} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${desiredLiveMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>LIVE</button>
                     <button onClick={() => {setDesiredLiveMode(false); handleUpdate();}} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!desiredLiveMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>DEMO</button>
                 </div>
            </div>
        </header>

        {/* Error Notification */}
        {errorMsg && (
            <div className="mx-8 mt-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm text-sm">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}

        {/* GLOBAL FILTERS */}
        <div className="px-8 pt-8 pb-4">
             <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col xl:flex-row gap-6 items-end">
                <div className="w-full xl:flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        {user.role === 'admin' ? 'Store Location (Admin Access)' : 'Authorized Store Location'}
                    </label>
                    <div className="relative">
                        {storeList.length > 0 ? (
                        <select 
                            value={selectedStore} 
                            onChange={(e) => setSelectedStore(e.target.value)} 
                            disabled={availableStores.length <= 1}
                            className={`w-full h-11 pl-4 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-slate-300 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all appearance-none ${availableStores.length > 1 ? 'cursor-pointer hover:bg-slate-950/80' : 'cursor-not-allowed opacity-75'}`}
                        >
                            {availableStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                        </select>
                        ) : (
                            <div className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-4">
                                <span className="text-sm text-slate-500 italic">Loading stores...</span>
                            </div>
                        )}

                        {availableStores.length > 1 && (
                            <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-4 w-full xl:w-auto">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Start Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-slate-300 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none hover:bg-slate-950/80 transition-colors [color-scheme:dark]" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">End Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-11 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-slate-300 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none hover:bg-slate-950/80 transition-colors [color-scheme:dark]" />
                    </div>
                </div>
                <div className="flex gap-3 w-full xl:w-auto">
                     <button 
                        onClick={handleUpdate} 
                        disabled={loading || !selectedStore} 
                        className="h-11 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update View'}
                     </button>
                     <button 
                        onClick={handleExport} 
                        disabled={!data || loading} 
                        className="h-11 w-11 flex items-center justify-center bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-emerald-400 text-slate-400 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50" 
                        title="Export to Excel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     </button>
                </div>
            </div>
        </div>

        {/* === VIEW: OVERVIEW === */}
        {view === 'OVERVIEW' && (
            <div className="px-8 pb-8 space-y-8 max-w-[1600px] mx-auto">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Sales</p>
                            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition-colors"><IconSales /></div>
                        </div>
                        {loading && !data ? <Skeleton className="h-10 w-32" /> : <h3 className="text-3xl font-bold text-white tracking-tight">${totalSales}</h3>}
                        <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full w-[75%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div></div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Guests</p>
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:bg-blue-500/20 transition-colors"><IconUsers /></div>
                        </div>
                        {loading && !data ? <Skeleton className="h-10 w-24" /> : <h3 className="text-3xl font-bold text-white tracking-tight">{totalGuests}</h3>}
                        <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full w-[45%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div></div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Ticket</p>
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20 transition-colors"><IconReceipt /></div>
                        </div>
                        {loading && !data ? <Skeleton className="h-10 w-32" /> : <h3 className="text-3xl font-bold text-white tracking-tight">${avgTicket}</h3>}
                        <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[60%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div></div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col h-[400px]">
                        <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-wider">Hourly Sales Trend</h3>
                        <div className="flex-1 w-full min-h-0">
                             {loading && !data ? <Skeleton className="w-full h-full" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} dy={10} interval={3} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(val) => `$${val}`} />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'}} 
                                            itemStyle={{color: '#fff'}}
                                            cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4'}}
                                        />
                                        <Area type="monotone" dataKey="netSales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{r: 6, strokeWidth: 0, fill: '#818cf8'}} />
                                    </AreaChart>
                                </ResponsiveContainer>
                             )}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 flex flex-col overflow-hidden h-[400px]">
                         <div className="p-6 border-b border-slate-800 bg-slate-900">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recent Transactions</h3>
                         </div>
                         <div className="overflow-auto flex-1 custom-scrollbar">
                             {loading && !data ? (
                                 <div className="p-6 space-y-4">
                                     <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                                 </div>
                             ) : (
                                 <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3">Time</th>
                                            <th className="px-6 py-3">Ticket</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {data?.sales.slice(0, 50).map((sale, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-3 text-slate-500 font-mono text-xs">{sale.saleOpenTime ? sale.saleOpenTime.substring(11, 16) : '--:--'}</td>
                                                <td className="px-6 py-3 font-medium text-slate-300">#{sale.ticketNo}</td>
                                                <td className="px-6 py-3 text-right font-bold text-white">${parseCurrency(sale.netSalesStr).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {(!data || data.sales.length === 0) && (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-xs italic">No data available for this range</td></tr>
                                        )}
                                    </tbody>
                                 </table>
                             )}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {/* === VIEW: REPORTS === */}
        {view === 'REPORTS' && (
            <div className="px-8 pb-8 space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-250px)] flex flex-col">
                {/* Tabs */}
                <div className="flex gap-4 border-b border-slate-800 pb-1">
                    <button 
                        onClick={() => setReportTab('MENU')} 
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${reportTab === 'MENU' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Menu Performance
                    </button>
                    <button 
                        onClick={() => setReportTab('DISCOUNTS')} 
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${reportTab === 'DISCOUNTS' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Discounts Analysis
                    </button>
                    <button 
                        onClick={() => setReportTab('STAFF')} 
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${reportTab === 'STAFF' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Staff Sales
                    </button>
                </div>

                {/* Tab Content: MENU */}
                {reportTab === 'MENU' && (
                    <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex-1 flex flex-col">
                        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-300">Item Sales Breakdown</h3>
                            <span className="text-xs text-slate-500">Sorted by Gross Revenue</span>
                        </div>
                        <div className="overflow-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3">Item Name</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3 text-right">Qty</th>
                                        <th className="px-6 py-3 text-right">Gross Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {menuPerformance.map((item: any, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-200">{item.menuName}</td>
                                            <td className="px-6 py-3 text-slate-500 text-xs">{item.categoryName}</td>
                                            <td className="px-6 py-3 text-right text-slate-400 font-mono">{item.quantity}</td>
                                            <td className="px-6 py-3 text-right font-bold text-white">${parseCurrency(item.totalGrossAmountStr).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {menuPerformance.length === 0 && (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">No menu data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab Content: DISCOUNTS */}
                {reportTab === 'DISCOUNTS' && (
                    <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex-1 flex flex-col">
                         <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                            <h3 className="text-sm font-bold text-slate-300">Discount Usage</h3>
                        </div>
                         <div className="overflow-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3">Discount Name</th>
                                        <th className="px-6 py-3">Reason</th>
                                        <th className="px-6 py-3">Applied By</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {data?.saleDetails.filter(d => d.check !== 'Total').map((d, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-200">{d.discountName}</td>
                                            <td className="px-6 py-3 text-slate-500 text-xs">{d.reason || '-'}</td>
                                            <td className="px-6 py-3 text-slate-400 text-xs">{d.discountAppliedBy}</td>
                                            <td className="px-6 py-3 text-right font-bold text-amber-400">-${parseCurrency(d.discountAmtStr).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {(!data?.saleDetails || data.saleDetails.length === 0) && (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">No discount data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab Content: STAFF */}
                {reportTab === 'STAFF' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6">
                            <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-wider">Top Performers</h3>
                             <ResponsiveContainer width="100%" height="90%">
                                <BarChart data={staffPerformance.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 11}} />
                                    <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff'}} />
                                    <Bar dataKey="sales" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-800">
                                <h3 className="text-sm font-bold text-slate-300">Staff Sales Detail</h3>
                            </div>
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3">Employee</th>
                                            <th className="px-6 py-3 text-right">Transactions</th>
                                            <th className="px-6 py-3 text-right">Total Sales</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {staffPerformance.map((s, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/50">
                                                <td className="px-6 py-3 font-medium text-slate-200">{s.name}</td>
                                                <td className="px-6 py-3 text-right text-slate-400">{s.count}</td>
                                                <td className="px-6 py-3 text-right font-bold text-white">${s.sales.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* === VIEW: SETTINGS === */}
        {view === 'SETTINGS' && (
            <div className="px-8 pb-8 max-w-[800px] mx-auto">
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                        <IconSettings />
                    </div>
                    <h3 className="text-xl font-bold text-white">System Configuration</h3>
                    <p className="text-slate-400">
                        Global settings and API configurations are managed by the administrator. 
                        <br/>Current Version: <span className="text-indigo-400 font-mono">v2.4.1</span>
                    </p>
                    <div className="pt-4">
                        <button className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium">Check for Updates</button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;