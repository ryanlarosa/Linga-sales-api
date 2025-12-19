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
  onRefresh: () => void;
  onMainExport: () => void;
  dataAvailable: boolean;
}

const DashboardFilters: React.FC<FiltersProps> = ({ 
  storeList, selectedStore, setSelectedStore, 
  fromDate, setFromDate, toDate, setToDate, 
  loading, onRefresh, onMainExport, dataAvailable 
}) => {
  return (
    <div className="px-8 pt-8 pb-4">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row gap-6 items-end transition-colors duration-300">
        <div className="w-full xl:flex-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Store Focus</label>
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)} 
            className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 ring-rose-500/20 transition-all appearance-none cursor-pointer dark:text-white"
          >
            {storeList.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
        </div>
        <div className="flex gap-4 w-full xl:w-auto">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Start Date</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)} 
              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 ring-rose-500/20 transition-all [color-scheme:light] dark:[color-scheme:dark] dark:text-white" 
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">End Date</label>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)} 
              className="w-full h-11 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 ring-rose-500/20 transition-all [color-scheme:light] dark:[color-scheme:dark] dark:text-white" 
            />
          </div>
        </div>
        <div className="flex gap-3 w-full xl:w-auto">
          <button 
            onClick={onRefresh} 
            disabled={loading} 
            className="h-11 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-600/20 transition-all active:scale-95 flex items-center justify-center min-w-[140px] disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> : null}
            {loading ? 'Processing...' : 'Sync Data'}
          </button>
          <button 
            onClick={onMainExport} 
            disabled={!dataAvailable || loading} 
            title="Download Full Sales Ledger (Excel)"
            className="h-11 w-11 flex items-center justify-center bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;