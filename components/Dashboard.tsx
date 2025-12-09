import React, { useState, useEffect } from 'react';
import { User, FetchedData } from '../types';
import { STORE_LIST } from '../constants';
import { fetchDashboardData } from '../services/api';
import { exportToExcel } from '../services/excelService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [selectedStore, setSelectedStore] = useState(STORE_LIST[0].id);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Controls desired mode, but data.isSimulated tells us actual result
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
      // If desiredLiveMode is true, forceMock = false.
      const result = await fetchDashboardData(selectedStore, new Date(fromDate), new Date(toDate), !desiredLiveMode);
      setData(result);
      
      // Check if we wanted live data but got simulated data
      if (desiredLiveMode && result.isSimulated) {
          setNotification({ 
            type: 'warning', 
            message: 'Live connection failed (CORS/Network). Switched to Demo Data automatically.' 
          });
          setDesiredLiveMode(false); // Reset switch to match reality
      } else if (desiredLiveMode && !result.isSimulated) {
           setNotification({ type: 'success', message: 'Connected to Live API successfully.' });
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
        setNotification({ type: 'success', message: 'Excel report generated successfully' });
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message });
      }
    }
  };

  // Process data for charts
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
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      {/* Notifications */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 border-l-4 animate-bounce-in 
            ${notification.type === 'error' ? 'bg-white text-red-800 border-red-500' : 
              notification.type === 'warning' ? 'bg-white text-amber-800 border-amber-500' :
              notification.type === 'success' ? 'bg-white text-emerald-800 border-emerald-500' : 'bg-slate-800 text-white border-blue-500'}`}>
             <span className="font-medium text-sm">{notification.message}</span>
             <button onClick={() => setNotification(null)} className="ml-2 text-current opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-slate-300 hidden md:flex flex-col flex-shrink-0 shadow-2xl z-20">
        <div className="h-20 flex items-center px-8 border-b border-slate-800/50">
           <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/30">
             <span className="text-white font-bold">L</span>
           </div>
           <h1 className="text-xl font-bold text-white tracking-tight">LingaPOS</h1>
        </div>

        <div className="p-6">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-indigo-600/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                <span className="font-medium">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-medium">Analytics</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                <span className="font-medium">Settings</span>
            </a>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span>Sign Out</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 relative">
        <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
            
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Sales Overview</h2>
                    <div className="flex items-center gap-2 mt-1">
                         <div className={`w-2.5 h-2.5 rounded-full ${data?.isSimulated ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                         <p className="text-slate-500 text-sm font-medium">
                            {data?.isSimulated ? 'Demo Environment (Simulated Data)' : 'Live Production Data'}
                         </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
                     <button 
                        onClick={() => setDesiredLiveMode(true)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${desiredLiveMode ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                     >
                        Live API
                     </button>
                     <button 
                        onClick={() => setDesiredLiveMode(false)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${!desiredLiveMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                     >
                        Demo Mode
                     </button>
                </div>
            </div>

            {/* Backend Info Warning (Only if strictly trying to use Live but failing) */}
            {data?.isSimulated && desiredLiveMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-4 text-amber-800 text-sm animate-fade-in">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                        <p className="font-bold">Backend Connection Required for Live Data</p>
                        <p className="mt-1 opacity-90">
                            The browser cannot connect directly to the secured LingaPOS API due to CORS security policies. 
                            We are currently showing high-fidelity demo data. To enable live data, you must deploy a backend proxy (Node.js/Firebase Functions).
                        </p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Store</label>
                        <div className="relative">
                            <select 
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
                            >
                                {STORE_LIST.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From</label>
                         <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                    </div>

                    <div className="md:col-span-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To</label>
                         <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                    </div>

                    <div className="md:col-span-3 flex gap-3">
                         <button 
                            onClick={loadData}
                            disabled={loading}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-70"
                         >
                            {loading ? 'Fetching...' : 'Update Data'}
                         </button>
                         <button 
                            onClick={handleExport}
                            disabled={!data || loading}
                            className="w-12 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                            title="Export to Excel"
                         >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-lg transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Net Revenue</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-2">${totalSales}</h3>
                            </div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                8.2%
                            </span>
                            <span className="text-slate-400 ml-2">vs last period</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-lg transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Guest Count</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-2">{totalGuests}</h3>
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        </div>
                         <div className="mt-4 flex items-center text-sm">
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                12.5%
                            </span>
                            <span className="text-slate-400 ml-2">vs last period</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-lg transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Avg Ticket</p>
                                <h3 className="text-3xl font-extrabold text-slate-800 mt-2">${avgTicket}</h3>
                            </div>
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                         <div className="mt-4 flex items-center text-sm">
                            <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                1.2%
                            </span>
                            <span className="text-slate-400 ml-2">vs last period</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up delay-75">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Activity</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} minTickGap={30} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                                        cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4'}}
                                    />
                                    <Area type="monotone" dataKey="netSales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                         <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Transactions</h3>
                         <div className="overflow-auto h-80 pr-2">
                             <table className="w-full text-left text-sm">
                                <thead className="text-xs text-slate-400 font-bold uppercase sticky top-0 bg-white">
                                    <tr>
                                        <th className="pb-3">Ticket</th>
                                        <th className="pb-3">Time</th>
                                        <th className="pb-3 text-right">Amount</th>
                                        <th className="pb-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.sales.slice(0, 8).map((sale) => (
                                        <tr key={sale.id} className="group hover:bg-slate-50 transition-colors">
                                            <td className="py-3 font-medium text-indigo-600">{sale.ticketNo}</td>
                                            <td className="py-3 text-slate-500">{sale.saleOpenTime}</td>
                                            <td className="py-3 text-right font-bold text-slate-800">${sale.grossReceiptStr}</td>
                                            <td className="py-3 text-right">
                                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">Paid</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                         </div>
                    </div>
                </div>
            )}
            
            {!data && !loading && (
                <div className="h-96 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="font-medium text-lg">No Data Loaded</p>
                    <p className="text-sm">Click "Update Data" to fetch latest analytics</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;