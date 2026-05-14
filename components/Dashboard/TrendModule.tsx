import React, { useState, useMemo } from 'react';
import { Store } from '../../types';
import { fetchStoreTrendSummary } from '../../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, RefreshCw, ChevronRight, Activity, Calendar
} from 'lucide-react';

interface TrendModuleProps {
  storeList: Store[];
  theme: 'light' | 'dark';
}

interface StoreTrendData {
  storeId: string;
  storeName: string;
  thisWk: number;
  lastWk: number;
  lastMth: number;
  lastYr: number;
}

const TrendModule: React.FC<TrendModuleProps> = ({ storeList, theme }) => {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<StoreTrendData[]>([]);
  const [progress, setProgress] = useState('');

  // Calculate the 4 anchor dates relative to "Today" (or custom anchor)
  const calculateAnchorDates = (anchor: Date = new Date()) => {
    const today = new Date(anchor);
    
    const lastWk = new Date(today);
    lastWk.setDate(today.getDate() - 7);
    
    const lastMth = new Date(today);
    lastMth.setMonth(today.getMonth() - 1);
    
    const lastYr = new Date(today);
    lastYr.setFullYear(today.getFullYear() - 1);

    return [today, lastWk, lastMth, lastYr];
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    const dates = calculateAnchorDates();
    const results: StoreTrendData[] = [];
    
    try {
      for (let i = 0; i < storeList.length; i++) {
        const store = storeList[i];
        setProgress(`Syncing ${store.name} (${i + 1}/${storeList.length})...`);
        
        const summary = await fetchStoreTrendSummary(store.id, dates);
        
        // Map DD-MON-YYYY keys back to our 4 categories
        const formatDate = (d: Date) => {
          const day = String(d.getDate()).padStart(2, '0');
          const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        };

        results.push({
          storeId: store.id,
          storeName: store.name,
          thisWk: summary[formatDate(dates[0])]?.covers || 0,
          lastWk: summary[formatDate(dates[1])]?.covers || 0,
          lastMth: summary[formatDate(dates[2])]?.covers || 0,
          lastYr: summary[formatDate(dates[3])]?.covers || 0,
        });
      }
      setTrendData(results);
    } catch (err) {
      console.error("Consolidated Sync Failed", err);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const formatVariance = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '+100%' : '0%';
    const varPct = ((curr - prev) / prev) * 100;
    const sign = varPct >= 0 ? '+' : '';
    return `${sign}${varPct.toFixed(1)}%`;
  };

  const totals = useMemo(() => {
    return trendData.reduce((acc, curr) => ({
      thisWk: acc.thisWk + curr.thisWk,
      lastWk: acc.lastWk + curr.lastWk,
      lastMth: acc.lastMth + curr.lastMth,
      lastYr: acc.lastYr + curr.lastYr,
    }), { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 });
  }, [trendData]);

  const chartData = [
    { name: 'Last Year', covers: totals.lastYr, fill: '#64748b' },
    { name: 'Last Month', covers: totals.lastMth, fill: '#94a3b8' },
    { name: 'Last Week', covers: totals.lastWk, fill: '#cbd5e1' },
    { name: 'Today', covers: totals.thisWk, fill: '#e11d48' },
  ];

  return (
    <div className="px-8 space-y-8 max-w-[1600px] mx-auto animate-fadeIn transition-all">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-3">
            <Activity className="text-rose-600" />
            Consolidated Cover Tracker
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Comparing guest trends across all venues for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        
        <button
          onClick={handleRefreshAll}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-rose-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          {loading ? progress : 'Sync All Stores Now'}
        </button>
      </div>

      {trendData.length > 0 && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
                    <Users className="text-rose-600" />
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${totals.thisWk >= totals.lastWk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    Vs Last Wk
                  </div>
               </div>
               <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Total Company Covers</p>
               <h3 className="text-4xl font-black mt-2 dark:text-white">{totals.thisWk.toLocaleString()}</h3>
               <p className={`text-sm font-bold mt-2 flex items-center gap-1 ${totals.thisWk >= totals.lastWk ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totals.thisWk >= totals.lastWk ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                  {formatVariance(totals.thisWk, totals.lastWk)}
                  <span className="text-slate-400 font-medium ml-1">since last week</span>
               </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden md:col-span-2">
               <div className="h-full w-full">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: theme === 'dark' ? '#1e293b' : 'white' }}
                      />
                      <Bar dataKey="covers" radius={[10, 10, 0, 0]} barSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>

          {/* Main Comparison Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Venue Name</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">This Week</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Last Week</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Last Month</th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Last Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trendData.map((row) => (
                    <tr key={row.storeId} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold dark:text-white group-hover:text-rose-600 transition-colors">{row.storeName}</span>
                      </td>
                      <td className="px-6 py-5 font-black text-lg dark:text-white">
                        {row.thisWk.toLocaleString()}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold dark:text-slate-300">{row.lastWk.toLocaleString()}</span>
                          <span className={`text-[10px] font-black flex items-center gap-0.5 ${row.thisWk >= row.lastWk ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {row.thisWk >= row.lastWk ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                            {formatVariance(row.thisWk, row.lastWk)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold dark:text-slate-300">{row.lastMth.toLocaleString()}</span>
                          <span className={`text-[10px] font-black flex items-center gap-0.5 ${row.thisWk >= row.lastMth ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {row.thisWk >= row.lastMth ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                            {formatVariance(row.thisWk, row.lastMth)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold dark:text-slate-300">{row.lastYr.toLocaleString()}</span>
                          <span className={`text-[10px] font-black flex items-center gap-0.5 ${row.thisWk >= row.lastYr ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {row.thisWk >= row.lastYr ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                            {formatVariance(row.thisWk, row.lastYr)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-900 text-white">
                    <td className="px-6 py-6 font-black uppercase tracking-widest text-rose-500">Company Total</td>
                    <td className="px-6 py-6 font-black text-2xl">{totals.thisWk.toLocaleString()}</td>
                    <td className="px-6 py-6 font-bold">{totals.lastWk.toLocaleString()}</td>
                    <td className="px-6 py-6 font-bold">{totals.lastMth.toLocaleString()}</td>
                    <td className="px-6 py-6 font-bold">{totals.lastYr.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && trendData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
           <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-6" />
           <h3 className="text-xl font-bold dark:text-white">Ready for Analysis</h3>
           <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-sm text-center">
             Click the sync button above to fetch data for all {storeList.length} stores and generate your consolidated trend report.
           </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32">
           <div className="relative">
              <div className="w-20 h-20 border-4 border-rose-100 dark:border-rose-900/20 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-rose-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
           </div>
           <p className="mt-8 text-rose-600 font-black uppercase tracking-widest animate-pulse">{progress}</p>
        </div>
      )}
    </div>
  );
};

export default TrendModule;
