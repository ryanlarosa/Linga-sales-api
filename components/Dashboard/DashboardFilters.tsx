
import React from 'react';
import { Store } from '../../types';

interface FiltersProps {
  storeList: Store[];
  selectedStore: string;
  setSelectedStore: (id: string) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
  loading: boolean;
  syncProgress?: string;
  onRefresh: () => void;
  onMainExport: () => void;
  dataAvailable: boolean;
}

const DashboardFilters: React.FC<FiltersProps> = ({ 
  storeList, selectedStore, setSelectedStore, 
  fromDate, setFromDate, toDate, setToDate, 
  loading, syncProgress, onRefresh, onMainExport, dataAvailable 
}) => {
  return (
    <div className="px-8 pt-8">
      <div className="bg-white dark:bg-slate-900/60 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap xl:flex-nowrap gap-2 items-center transition-all duration-300">
        
        {/* Store Select */}
        <div className="flex-1 min-w-[240px]">
          <div className="relative group">
            <select 
              value={selectedStore} 
              onChange={(e) => setSelectedStore(e.target.value)} 
              className="w-full h-12 pl-4 pr-10 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 ring-rose-500/20 transition-all appearance-none cursor-pointer dark:text-white"
            >
              {storeList.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
          <input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)} 
            className="h-10 px-3 bg-transparent text-[10px] font-bold uppercase outline-none [color-scheme:light] dark:[color-scheme:dark] dark:text-white" 
          />
          <span className="text-slate-300 font-bold px-1">/</span>
          <input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)} 
            className="h-10 px-3 bg-transparent text-[10px] font-bold uppercase outline-none [color-scheme:light] dark:[color-scheme:dark] dark:text-white" 
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={onRefresh} 
            disabled={loading} 
            className="h-12 px-8 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-900/10 transition-all active:scale-95 flex items-center justify-center min-w-[200px] disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{syncProgress || 'Syncing...'}</span>
              </div>
            ) : 'Synchronize'}
          </button>
          
          <button 
            onClick={onMainExport} 
            disabled={!dataAvailable || loading} 
            title="Export Raw Ledger (XLSX)"
            className="h-12 w-12 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-20 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;
