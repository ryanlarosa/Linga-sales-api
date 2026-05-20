import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Store } from '../../types';
import { fetchStoreTrendSummary } from '../../services/api';
import { exportTrendToExcel } from '../../services/excelService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, RefreshCw, ChevronRight, ChevronDown, SlidersHorizontal, Activity, Calendar, Download
} from 'lucide-react';

interface TrendModuleProps {
  storeList: Store[];
  theme: 'light' | 'dark';
  anchorDate?: string; // Optional default anchor date from global filter
}

interface StoreTrendData {
  storeId: string;
  storeName: string;
  thisWk: number;
  lastWk: number;
  lastMth: number;
  lastYr: number;
}

const TrendModule: React.FC<TrendModuleProps> = ({ storeList, theme, anchorDate }) => {
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<StoreTrendData[]>([]);
  const [progress, setProgress] = useState('');
  
  // Emailling/Drive reports states
  const [sendingReport, setSendingReport] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Local Date selector initialized to default anchorDate or today
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (anchorDate) return anchorDate;
    return new Date().toISOString().split('T')[0];
  });

  // Local storage persisted store selection checklist
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load selection checklist from localStorage
  useEffect(() => {
    if (storeList.length > 0) {
      const saved = localStorage.getItem('linga_cover_tracker_selected_stores');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validIds = parsed.filter(id => storeList.some(s => s.id === id));
            if (validIds.length > 0) {
              setSelectedStoreIds(validIds);
              return;
            }
          }
        } catch (e) {
          console.error('Error loading stored venues', e);
        }
      }
      // Default: check all stores
      setSelectedStoreIds(storeList.map(s => s.id));
    }
  }, [storeList]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate the 4 anchor dates relative to the selectedDate
  // Using 364 days (52 weeks) and 28 days (4 weeks) to ensure we compare the same day of the week
  const calculateAnchorDates = (anchor: string) => {
    const today = new Date(anchor);
    
    const lastWk = new Date(today);
    lastWk.setDate(today.getDate() - 7);
    
    const lastMth = new Date(today);
    lastMth.setDate(today.getDate() - 28);
    
    const lastYr = new Date(today);
    lastYr.setDate(today.getDate() - 364);

    return [today, lastWk, lastMth, lastYr];
  };

  const anchorDates = useMemo(() => calculateAnchorDates(selectedDate), [selectedDate]);

  const handleRefreshAll = async () => {
    if (selectedStoreIds.length === 0) return;
    setLoading(true);
    setSendResult(null); // Clear any old send results when re-syncing
    const dates = anchorDates;
    const results: StoreTrendData[] = [];
    
    // Only iterate selected stores
    const activeStores = storeList.filter(s => selectedStoreIds.includes(s.id));
    
    try {
      for (let i = 0; i < activeStores.length; i++) {
        const store = activeStores[i];
        setProgress(`Syncing ${store.name} (${i + 1}/${activeStores.length})...`);
        
        const summary = await fetchStoreTrendSummary(store.id, dates);
        
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

  const totals = useMemo(() => {
    return trendData.reduce((acc, curr) => ({
      thisWk: acc.thisWk + curr.thisWk,
      lastWk: acc.lastWk + curr.lastWk,
      lastMth: acc.lastMth + curr.lastMth,
      lastYr: acc.lastYr + curr.lastYr,
    }), { thisWk: 0, lastWk: 0, lastMth: 0, lastYr: 0 } as Omit<StoreTrendData, 'storeId' | 'storeName'>);
  }, [trendData]);

  const handleExport = () => {
    exportTrendToExcel(trendData, totals, selectedDate, anchorDates);
  };

  const handleEmailAndDrive = async () => {
    if (trendData.length === 0) return;
    setSendingReport(true);
    setSendResult(null);
    try {
      const response = await fetch('/api/v1/reports/email-cover-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedDate,
          selectedStoreIds,
          trendData,
          totals
        })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        setSendResult({ success: true, message: 'Report successfully emailed and saved to Google Drive!' });
      } else {
        setSendResult({ success: false, message: resData.error || 'Failed to send report.' });
      }
    } catch (err: any) {
      setSendResult({ success: false, message: err.message || 'Error occurred while sending report.' });
    } finally {
      setSendingReport(false);
    }
  };

  const formatVariance = (curr: number, prev: number) => {
    const diff = curr - prev;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toLocaleString()}`;
  };

  const chartData = [
    { name: 'Last Year', covers: totals.lastYr, fill: '#64748b' },
    { name: 'Last Month', covers: totals.lastMth, fill: '#94a3b8' },
    { name: 'Last Week', covers: totals.lastWk, fill: '#cbd5e1' },
    { name: 'Selected Day', covers: totals.thisWk, fill: '#e11d48' },
  ];

  const formatDateTiny = (d: Date) => {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;
  };

  return (
    <div className="px-8 space-y-8 max-w-[1600px] mx-auto animate-fadeIn transition-all">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-4 xl:space-y-0 xl:flex xl:items-center xl:gap-8 flex-1">
            <div>
              <h2 className="text-2xl font-bold dark:text-white flex items-center gap-3">
                <Activity className="text-rose-600" />
                Consolidated Cover Tracker
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Comparing trends anchored to <span className="font-bold text-rose-600">{new Date(selectedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 xl:pt-0">
              {/* Custom Date Input */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Report Date</span>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setTrendData([]);
                    }}
                    className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 pl-10 pr-4 py-3 rounded-2xl font-bold text-sm border-0 focus:ring-2 focus:ring-rose-500 focus:bg-white dark:focus:bg-slate-700 cursor-pointer transition-all outline-none"
                  />
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Stores Multi-Select Checklist */}
              <div className="flex flex-col gap-1" ref={dropdownRef}>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Filter Venues</span>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 pl-10 pr-4 py-3 rounded-2xl font-bold text-sm border-0 focus:ring-2 focus:ring-rose-500 flex items-center justify-between gap-3 min-w-[200px] text-left cursor-pointer transition-all outline-none"
                  >
                    <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <span>{selectedStoreIds.length === storeList.length ? 'All Stores Selected' : `${selectedStoreIds.length} Stores Selected`}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-850 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-4 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => {
                            const allIds = storeList.map(s => s.id);
                            setSelectedStoreIds(allIds);
                            localStorage.setItem('linga_cover_tracker_selected_stores', JSON.stringify(allIds));
                            setTrendData([]);
                          }}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-700 transition-colors uppercase tracking-wider"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStoreIds([]);
                            localStorage.setItem('linga_cover_tracker_selected_stores', JSON.stringify([]));
                            setTrendData([]);
                          }}
                          className="text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-wider"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {storeList.map((store) => {
                          const isChecked = selectedStoreIds.includes(store.id);
                          return (
                            <label
                              key={store.id}
                              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  let updated: string[];
                                  if (isChecked) {
                                    updated = selectedStoreIds.filter(id => id !== store.id);
                                  } else {
                                    updated = [...selectedStoreIds, store.id];
                                  }
                                  setSelectedStoreIds(updated);
                                  localStorage.setItem('linga_cover_tracker_selected_stores', JSON.stringify(updated));
                                  setTrendData([]);
                                }}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                {store.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            {trendData.length > 0 && (
              <>
                <button
                  onClick={handleEmailAndDrive}
                  disabled={sendingReport || loading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RefreshCw className={`w-5 h-5 ${sendingReport ? 'animate-spin' : ''}`} />
                  {sendingReport ? 'Sending...' : 'Email & Save to Drive'}
                </button>
                <button
                  onClick={handleExport}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  Export Tracker
                </button>
              </>
            )}
            <button
              onClick={handleRefreshAll}
              disabled={loading || selectedStoreIds.length === 0 || sendingReport}
              className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-rose-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {loading ? progress : 'Sync Selected'}
            </button>
          </div>
        </div>

        {sendResult && (
          <div className={`px-6 py-4 rounded-2xl text-xs font-bold border transition-all ${sendResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
            {sendResult.message}
          </div>
        )}
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
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b dark:border-slate-800">Venue Name</th>
                    <th className="px-6 py-5 border-b dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selected Day</span>
                        <span className="text-[10px] font-bold text-rose-600">{formatDateTiny(anchorDates[0])}</span>
                      </div>
                    </th>
                    <th className="px-6 py-5 border-b dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Week</span>
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTiny(anchorDates[1])}</span>
                      </div>
                    </th>
                    <th className="px-6 py-5 border-b dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Month</span>
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTiny(anchorDates[2])}</span>
                      </div>
                    </th>
                    <th className="px-6 py-5 border-b dark:border-slate-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Year</span>
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTiny(anchorDates[3])}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trendData.map((row: StoreTrendData) => (
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
             Select a date and click **Sync Selected** to generate your consolidated tracker for {new Date(selectedDate.replace(/-/g, '\/')).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
           </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-32">
           <div className="relative">
              <div className="w-20 h-20 border-4 border-rose-100 dark:border-rose-900/20 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-rose-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
           </div>
           <p className="mt-8 text-rose-600 font-black uppercase tracking-widest animate-pulse text-sm font-bold text-center px-4 max-w-md">{progress}</p>
        </div>
      )}
    </div>
  );
};

export default TrendModule;
