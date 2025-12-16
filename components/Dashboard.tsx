import React, { useState, useEffect } from 'react';
import { User, FetchedData } from '../types';
import { STORE_LIST } from '../constants';
import { fetchDashboardData } from '../services/api';
import { exportToExcel } from '../services/excelService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Icons
const IconSales = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconUsers = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const IconReceipt = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`}></div>
);

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [selectedStore, setSelectedStore] = useState(STORE_LIST[0].id);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [desiredLiveMode, setDesiredLiveMode] = useState<boolean>(true); // Default to True for user request
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // ForceMock is inverted here: if desiredLiveMode is true, forceMock is false
      const result = await fetchDashboardData(selectedStore, new Date(fromDate), new Date(toDate), !desiredLiveMode);
      setData(result);
      
      if (desiredLiveMode && result.isSimulated) {
        setErrorMsg("Could not connect to live API. Showing Demo Data.");
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

  // Handle "Update" click
  const handleUpdate = () => {
    loadData();
  };

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
  
  // Fill in missing hours for smoother chart
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
      <aside className="w-72 bg-slate-900 text-slate-300 hidden md:flex flex-col flex-shrink-0 z-20 shadow-2xl">
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
           <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/20">
             <span className="text-white font-bold text-lg">L</span>
           </div>
           <h1 className="text-lg font-bold text-white tracking-wide">LingaPOS</h1>
        </div>

        <div className="p-6">
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div>
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-2">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-900/20 transition-all group">
                <svg className="w-5 h-5 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                <span className="font-medium text-sm">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all group">
                 <svg className="w-5 h-5 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-medium text-sm">Reports</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all group">
                 <svg className="w-5 h-5 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="font-medium text-sm">Settings</span>
            </a>
        </nav>
        
        <div className="p-6 border-t border-slate-800">
            <button onClick={onLogout} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium w-full">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-8 py-5 flex justify-between items-center shadow-sm">
             <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Analytics Overview</h2>
                <div className="flex items-center gap-2 mt-1">
                     <span className={`inline-block w-2 h-2 rounded-full ${data?.isSimulated ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                     <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        {data?.isSimulated ? 'Demo Environment' : 'Live Data Connection'}
                     </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="bg-slate-100 rounded-lg p-1 flex">
                     <button onClick={() => {setDesiredLiveMode(true); handleUpdate();}} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${desiredLiveMode ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>LIVE</button>
                     <button onClick={() => {setDesiredLiveMode(false); handleUpdate();}} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!desiredLiveMode ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}>DEMO</button>
                 </div>
            </div>
        </header>

        {/* Error Notification */}
        {errorMsg && (
            <div className="mx-8 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className="font-medium text-sm">{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            
            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-6 items-end">
                <div className="w-full xl:flex-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Store Location</label>
                    <select 
                        value={selectedStore} 
                        onChange={(e) => setSelectedStore(e.target.value)} 
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:border-slate-300"
                    >
                        {STORE_LIST.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                </div>
                <div className="flex gap-4 w-full xl:w-auto">
                    <div className="flex-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">From</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">To</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                    </div>
                </div>
                <div className="flex gap-3 w-full xl:w-auto">
                     <button 
                        onClick={handleUpdate} 
                        disabled={loading} 
                        className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center min-w-[120px]"
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Update'}
                     </button>
                     <button 
                        onClick={() => data && exportToExcel(data, selectedStore)} 
                        disabled={!data || loading} 
                        className="h-11 w-11 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-emerald-600 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50" 
                        title="Download Excel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sales Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Sales</p>
                            {loading && !data ? <Skeleton className="h-10 w-32" /> : (
                                <h3 className="text-4xl font-black text-slate-800 tracking-tight">${totalSales}</h3>
                            )}
                        </div>
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                            <IconSales />
                        </div>
                    </div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-[75%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                     </div>
                </div>

                {/* Guest Count Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Guests</p>
                             {loading && !data ? <Skeleton className="h-10 w-24" /> : (
                                <h3 className="text-4xl font-black text-slate-800 tracking-tight">{totalGuests}</h3>
                             )}
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                            <IconUsers />
                        </div>
                    </div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full w-[45%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                     </div>
                </div>

                {/* Avg Ticket Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Average Ticket</p>
                             {loading && !data ? <Skeleton className="h-10 w-32" /> : (
                                <h3 className="text-4xl font-black text-slate-800 tracking-tight">${avgTicket}</h3>
                             )}
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                            <IconReceipt />
                        </div>
                    </div>
                     <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[60%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                     </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        Hourly Performance
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                         {loading && !data ? <Skeleton className="w-full h-full" /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="time" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} 
                                        dy={10} 
                                        interval={3}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 500}} 
                                        tickFormatter={(val) => `$${val}`} 
                                    />
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                        itemStyle={{color: '#fff'}}
                                        cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4'}}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="netSales" 
                                        stroke="#6366f1" 
                                        strokeWidth={3} 
                                        fillOpacity={1} 
                                        fill="url(#colorSales)" 
                                        activeDot={{r: 6, strokeWidth: 0, fill: '#4f46e5'}}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                         )}
                    </div>
                </div>

                {/* Side Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                     <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-800">Recent Sales</h3>
                     </div>
                     <div className="overflow-auto flex-1">
                         {loading && !data ? (
                             <div className="p-6 space-y-4">
                                 <Skeleton className="h-10 w-full" />
                                 <Skeleton className="h-10 w-full" />
                                 <Skeleton className="h-10 w-full" />
                                 <Skeleton className="h-10 w-full" />
                             </div>
                         ) : (
                             <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold">Time</th>
                                        <th className="px-6 py-3 font-semibold">Ticket</th>
                                        <th className="px-6 py-3 font-semibold text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data?.sales.slice(0, 8).map((sale, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-3.5 text-slate-500 font-medium">{sale.saleOpenTime.substring(11, 16)}</td>
                                            <td className="px-6 py-3.5 font-medium text-slate-700">#{sale.ticketNo}</td>
                                            <td className="px-6 py-3.5 text-right font-bold text-slate-900">${sale.grossReceiptStr}</td>
                                        </tr>
                                    ))}
                                    {(!data || data.sales.length === 0) && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">No recent transactions found</td>
                                        </tr>
                                    )}
                                </tbody>
                             </table>
                         )}
                     </div>
                </div>
            </div>

            {/* Disclaimer */}
            <div className="text-center pb-6">
                <p className="text-xs text-slate-400">© 2024 LingaPOS. All system data is confidential.</p>
            </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;