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

// Custom Icons
const IconSales = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconUsers = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const IconReceipt = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`}></div>
);

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [selectedStore, setSelectedStore] = useState(STORE_LIST[0].id);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(true);
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
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
    loadData();
  }, [selectedStore]);

  const handleUpdate = () => loadData();

  // Chart Data Preparation
  const salesByHour = new Map<string, number>();
  if (data) {
    data.saleSummary.forEach(item => {
        if(item.saleOpenDate) {
            const date = new Date(item.saleOpenDate);
            const key = date.getHours();
            const val = parseFloat(item.netSales);
            salesByHour.set(String(key), (salesByHour.get(String(key)) || 0) + val);
        }
    });
  }
  const chartData = [];
  for(let i=0; i<24; i++) {
      chartData.push({
          time: `${i}:00`,
          netSales: salesByHour.get(String(i)) || 0
      });
  }

  const totalSales = data ? data.saleSummary.reduce((acc, curr) => acc + parseFloat(curr.netSales), 0).toFixed(2) : "0.00";
  const totalGuests = data ? data.sales.reduce((acc, curr) => acc + curr.guestCount, 0) : 0;
  const avgTicket = data && data.sales.length > 0 ? (parseFloat(totalSales) / data.sales.length).toFixed(2) : "0.00";

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 text-slate-300 hidden md:flex flex-col flex-shrink-0 z-20 border-r border-slate-900">
        <div className="h-20 flex items-center px-6 border-b border-slate-900">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/30">
             <span className="text-white font-bold text-lg">L</span>
           </div>
           <h1 className="text-lg font-bold text-white tracking-wide">LingaPOS</h1>
        </div>

        <div className="p-6">
            <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                <span className="font-medium text-sm">Overview</span>
            </a>
             <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-medium text-sm">Sales Reports</span>
            </a>
            <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Settings</p>
            </div>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-medium text-sm">Configuration</span>
            </a>
        </nav>
        
        <div className="p-4 border-t border-slate-900">
            <button onClick={onLogout} className="flex items-center gap-3 text-slate-500 hover:text-white transition-colors text-sm font-medium w-full px-2 py-2">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-4 flex justify-between items-center shadow-sm h-20">
             <div>
                <h2 className="text-xl font-bold text-slate-800">Analytics Overview</h2>
                <div className="flex items-center gap-2 mt-0.5">
                     <span className={`w-2 h-2 rounded-full ${data?.isSimulated ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`}></span>
                     <p className="text-slate-400 text-xs font-medium">
                        {data?.isSimulated ? 'Offline / Demo Mode' : 'Live Data Stream'}
                     </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="bg-slate-100 p-1 rounded-lg flex">
                     <button onClick={() => {setDesiredLiveMode(true); handleUpdate();}} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${desiredLiveMode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>LIVE</button>
                     <button onClick={() => {setDesiredLiveMode(false); handleUpdate();}} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${!desiredLiveMode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>DEMO</button>
                 </div>
            </div>
        </header>

        {/* Error Notification */}
        {errorMsg && (
            <div className="mx-8 mt-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm text-sm">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-amber-600 hover:text-amber-800">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            
            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-6 items-end">
                <div className="w-full xl:flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Store Location</label>
                    <div className="relative">
                        <select 
                            value={selectedStore} 
                            onChange={(e) => setSelectedStore(e.target.value)} 
                            className="w-full h-11 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-100"
                        >
                            {STORE_LIST.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                        </select>
                        <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 w-full xl:w-auto">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Start Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none hover:bg-slate-100 transition-colors" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">End Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none hover:bg-slate-100 transition-colors" />
                    </div>
                </div>
                <div className="flex gap-3 w-full xl:w-auto">
                     <button 
                        onClick={handleUpdate} 
                        disabled={loading} 
                        className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update View'}
                     </button>
                     <button 
                        onClick={() => data && exportToExcel(data, selectedStore)} 
                        disabled={!data || loading} 
                        className="h-11 w-11 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 text-slate-400 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50" 
                        title="Export to Excel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Sales</p>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><IconSales /></div>
                    </div>
                    {loading && !data ? <Skeleton className="h-10 w-32" /> : <h3 className="text-3xl font-bold text-slate-800 tracking-tight">${totalSales}</h3>}
                    <div className="mt-4 w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full w-[75%] rounded-full"></div></div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Guests</p>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><IconUsers /></div>
                    </div>
                    {loading && !data ? <Skeleton className="h-10 w-24" /> : <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{totalGuests}</h3>}
                    <div className="mt-4 w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div className="bg-blue-500 h-full w-[45%] rounded-full"></div></div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Ticket</p>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><IconReceipt /></div>
                    </div>
                    {loading && !data ? <Skeleton className="h-10 w-32" /> : <h3 className="text-3xl font-bold text-slate-800 tracking-tight">${avgTicket}</h3>}
                    <div className="mt-4 w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[60%] rounded-full"></div></div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Hourly Sales Trend</h3>
                    <div className="flex-1 w-full min-h-0">
                         {loading && !data ? <Skeleton className="w-full h-full" /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} interval={3} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip contentStyle={{backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff'}} itemStyle={{color: '#fff'}} />
                                    <Area type="monotone" dataKey="netSales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                         )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[400px]">
                     <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Transactions</h3>
                     </div>
                     <div className="overflow-auto flex-1">
                         {loading && !data ? (
                             <div className="p-6 space-y-4">
                                 <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                             </div>
                         ) : (
                             <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Time</th>
                                        <th className="px-6 py-3">Ticket</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data?.sales.slice(0, 10).map((sale, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-3 text-slate-500 font-mono text-xs">{sale.saleOpenTime.substring(11, 16)}</td>
                                            <td className="px-6 py-3 font-medium text-slate-700">#{sale.ticketNo}</td>
                                            <td className="px-6 py-3 text-right font-bold text-slate-900">${sale.grossReceiptStr}</td>
                                        </tr>
                                    ))}
                                    {(!data || data.sales.length === 0) && (
                                        <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-xs italic">No data available for this range</td></tr>
                                    )}
                                </tbody>
                             </table>
                         )}
                     </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;