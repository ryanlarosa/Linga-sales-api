import React, { useState, useEffect } from 'react';
import { User, FetchedData } from '../types';
import { STORE_LIST } from '../constants';
import { fetchDashboardData } from '../services/api';
import { exportToExcel } from '../services/excelService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Helper: Skeleton Component
const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`}></div>
);

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [selectedStore, setSelectedStore] = useState(STORE_LIST[0].id);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(false);
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'info' | 'error' | 'warning', message: string} | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchDashboardData(selectedStore, new Date(fromDate), new Date(toDate), !desiredLiveMode);
      setData(result);
      
      if (desiredLiveMode && result.isSimulated) {
          setNotification({ 
            type: 'warning', 
            message: 'Connection failed. Switched to Demo Mode.' 
          });
          setDesiredLiveMode(false);
      } else if (desiredLiveMode && !result.isSimulated) {
           setNotification({ type: 'success', message: 'Live Data Connected.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStore, desiredLiveMode]); 

  const handleExport = () => {
    if (data) {
      try {
        exportToExcel(data, selectedStore);
        setNotification({ type: 'success', message: 'Excel downloaded.' });
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message });
      }
    }
  };

  const salesByHour = new Map<string, number>();
  if (data) {
    data.saleSummary.forEach(item => {
        if(item.saleOpenDate) {
            const date = new Date(item.saleOpenDate);
            const key = date.getHours().toString().padStart(2, '0') + ":00";
            const val = parseFloat(item.netSales);
            salesByHour.set(key, (salesByHour.get(key) || 0) + val);
        }
    });
  }
  const chartData = Array.from(salesByHour.entries())
    .map(([time, value]) => ({ time, netSales: value }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const totalSales = data ? data.saleSummary.reduce((acc, curr) => acc + parseFloat(curr.netSales), 0).toFixed(2) : "0.00";
  const totalGuests = data ? data.sales.reduce((acc, curr) => acc + curr.guestCount, 0) : 0;
  const avgTicket = data && data.sales.length > 0 ? (parseFloat(totalSales) / data.sales.length).toFixed(2) : "0.00";

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 border-l-4 animate-bounce-in backdrop-blur-md bg-white/90
            ${notification.type === 'error' ? 'text-red-800 border-red-500' : 
              notification.type === 'warning' ? 'text-amber-800 border-amber-500' :
              notification.type === 'success' ? 'text-emerald-800 border-emerald-500' : 'text-blue-800 border-blue-500'}`}>
             <span className="font-medium text-sm">{notification.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col flex-shrink-0 z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
           <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/20">
             <span className="text-white font-bold text-lg">L</span>
           </div>
           <h1 className="text-lg font-bold text-white tracking-tight">LingaPOS</h1>
        </div>

        <div className="p-6 pb-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{user.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-900/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                <span className="font-medium text-sm">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-medium text-sm">Reports</span>
            </a>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span className="font-medium">Sign Out</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 relative">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-8 py-4 flex justify-between items-center shadow-sm">
             <div>
                <h2 className="text-xl font-bold text-slate-800">Sales Overview</h2>
                <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${data?.isSimulated ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                     <p className="text-slate-500 text-xs font-medium">
                        {data?.isSimulated ? 'Demo Environment' : 'Live Connected'}
                     </p>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setDesiredLiveMode(true)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${desiredLiveMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Live</button>
                 <button onClick={() => setDesiredLiveMode(false)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!desiredLiveMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Demo</button>
            </div>
        </header>

        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
            {/* Filter Bar */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Store Location</label>
                    <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                        {STORE_LIST.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-40">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">From</label>
                     <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="w-full md:w-40">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">To</label>
                     <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                     <button onClick={loadData} disabled={loading} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center min-w-[100px]">
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update'}
                     </button>
                     <button onClick={handleExport} disabled={!data || loading} className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50" title="Export Excel">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </button>
                </div>
            </div>

            {/* KPI Cards Loading State */}
            {loading && !data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
            )}

            {/* KPI Cards */}
            {!loading && data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Sales</p>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">${totalSales}</h3>
                            </div>
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-[70%] rounded-full"></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guest Count</p>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{totalGuests}</h3>
                            </div>
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[45%] rounded-full"></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Ticket</p>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">${avgTicket}</h3>
                            </div>
                            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 w-[60%] rounded-full"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Loading */}
            {loading && !data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80" />
                    <Skeleton className="h-80" />
                </div>
            )}

            {/* Charts & Table */}
            {!loading && data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Hourly Sales</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                                        cursor={{stroke: '#6366f1', strokeWidth: 1}}
                                    />
                                    <Area type="monotone" dataKey="netSales" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-0 rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                         <div className="p-6 border-b border-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
                         </div>
                         <div className="overflow-auto flex-1 p-0">
                             <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Ticket</th>
                                        <th className="px-6 py-3">Time</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data.sales.slice(0, 7).map((sale) => (
                                        <tr key={sale.id} className="group hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 font-medium text-indigo-600">{sale.ticketNo}</td>
                                            <td className="px-6 py-4 text-slate-500">{sale.saleOpenTime}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">${sale.grossReceiptStr}</td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                         </div>
                    </div>
                </div>
            )}
            
            {!data && !loading && (
                <div className="h-96 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                    <p className="font-medium text-lg">No Data Displayed</p>
                    <p className="text-sm">Select date range and click Update</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;