
import React, { forwardRef, useMemo } from 'react';
import { FetchedData } from '../../../types';
import { formatAED, parseCurrency } from './ReportUtils';

interface DSRRecapProps {
  data: FetchedData;
  dsrStats: any;
  fromDate: string;
  selectedStoreName: string;
  modName: string;
  setModName: (val: string) => void;
  bohName: string;
  setBohName: (val: string) => void;
  operationalTarget: number;
  setOperationalTarget: (val: number) => void;
  exporting: boolean;
  onExportPDF: () => void;
}

const DSRRecap = forwardRef<HTMLDivElement, DSRRecapProps>(({
  data, dsrStats, fromDate, selectedStoreName, 
  modName, setModName, bohName, setBohName, 
  operationalTarget, setOperationalTarget, exporting, onExportPDF
}, ref) => {
  const dayName = new Date(fromDate).toLocaleDateString('en-AE', { weekday: 'long' });
  
  const totalSettledExclTips = useMemo(() => {
    return (data.paymentSummary || []).reduce((acc, p) => acc + p.amount, 0);
  }, [data.paymentSummary]);

  const totalTips = useMemo(() => {
    return (data.paymentSummary || []).reduce((acc, p) => acc + p.tips, 0);
  }, [data.paymentSummary]);

  const variance = dsrStats.net - operationalTarget;
  const variancePct = operationalTarget > 0 ? (variance / operationalTarget) * 100 : 0;

  const discountGroups = Array.from(data.saleDetails.filter(d => d.check !== 'Total').reduce((acc, curr) => {
    const existing = acc.get(curr.discountName) || { count: 0, amount: 0 };
    existing.count += curr.quantity || 1;
    existing.amount += parseCurrency(curr.discountAmtStr);
    acc.set(curr.discountName, existing);
    return acc;
  }, new Map<string, {count: number, amount: number}>()).entries());

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12" ref={ref}>
      {/* HEADER INFO CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="bg-[#001f3f] px-4 py-2 flex justify-between items-center">
            <h4 className="text-[10px] font-black uppercase text-white tracking-widest">Store Insight</h4>
            <span className="text-[10px] text-rose-400 font-bold">{dayName}</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
              <span className="text-xs font-black text-rose-600">{selectedStoreName}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Reporting Date</span>
              <span className="text-xs font-black text-slate-900 dark:text-white">{fromDate}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="bg-[#001f3f] px-4 py-2">
            <h4 className="text-[10px] font-black uppercase text-white tracking-widest">Management Duty</h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manager on Duty</label>
              <input value={modName} onChange={e => setModName(e.target.value)} className="w-full text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-800 outline-none focus:border-rose-500 no-print" />
              <span className="text-xs font-black print-only hidden">{modName}</span>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Kitchen Lead (BOH)</label>
              <input value={bohName} onChange={e => setBohName(e.target.value)} className="w-full text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-800 outline-none focus:border-rose-500 no-print" />
              <span className="text-xs font-black print-only hidden">{bohName}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-center px-4">
           <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Checks Processed</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{dsrStats.checks}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Guest Footfall</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{dsrStats.guestCount}</p>
              </div>
           </div>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded shadow-sm">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatAED(dsrStats.discTotal)}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total System Reductions</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded shadow-sm flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white">{dsrStats.checks} / {dsrStats.guestCount}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Check / Cover Ratio</p>
          </div>
          <div className="text-right">
             <h3 className="text-xl font-black text-rose-600">{formatAED(dsrStats.avgGuest)}</h3>
             <p className="text-[9px] font-bold text-slate-400 uppercase">Avg Spend</p>
          </div>
        </div>
      </div>

      {/* NET SALES HEADER BLOCK */}
      <div className="bg-[#001f3f] text-white p-8 rounded shadow-lg flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Net Realized Sales</p>
            <h3 className="text-4xl font-black">{formatAED(dsrStats.net)}</h3>
          </div>
          <div className="hidden md:block opacity-20">
             <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"/></svg>
          </div>
      </div>

      {/* TABLES SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REVENUE SPLIT */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3 tracking-wider">Net Revenue Split - Venue Level</h4>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="px-4 py-6 font-bold text-slate-900 dark:text-white uppercase text-[10px]">Actual (Today)</td>
                <td className="px-4 py-6 text-right font-black text-rose-600 text-lg">{formatAED(dsrStats.net)}</td>
                <td className="px-4 py-6 text-right text-slate-400 text-[10px] font-bold uppercase">
                  {dsrStats.checks} Checks<br/>{dsrStats.guestCount} Covers
                </td>
              </tr>
              <tr className="bg-slate-50/50 dark:bg-slate-950/20">
                <td className="px-4 py-4 text-slate-400 uppercase font-bold text-[10px]">Operational Target</td>
                <td className="px-4 py-4 text-right">
                  <input type="number" value={operationalTarget || ''} onChange={(e) => setOperationalTarget(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-24 bg-transparent border-b border-slate-300 dark:border-slate-700 text-right font-mono outline-none no-print" />
                  <span className="print-only hidden">{operationalTarget}</span>
                </td>
                <td className="px-4 py-4 text-right text-slate-400 font-bold uppercase text-[10px]">Budget Line</td>
              </tr>
              <tr className="bg-slate-900 text-white font-bold">
                <td className="px-4 py-4 uppercase text-[10px] text-slate-400">Target Variance</td>
                <td className="px-4 py-4 text-right font-black">{formatAED(variance)}</td>
                <td className="px-4 py-4 text-right text-[10px]">{variancePct.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SETTLEMENT SUMMARY */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3 tracking-wider">Settlement Summary</h4>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 text-left">Tender Type</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Settled Amount</th>
                <th className="px-4 py-3 text-right">Tip (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.paymentSummary?.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{p.name}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{p.count}</td>
                  <td className="px-4 py-3 text-right font-black font-mono">{formatAED(p.amount)}</td>
                  <td className="px-4 py-3 text-right font-black font-mono text-emerald-600">+{formatAED(p.tips)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#001f3f] text-white font-black">
              <tr>
                <td colSpan={2} className="px-4 py-4 uppercase text-[10px] opacity-60">Total Settlements</td>
                <td className="px-4 py-4 text-right text-sm text-rose-400">{formatAED(totalSettledExclTips)}</td>
                <td className="px-4 py-4 text-right text-sm text-emerald-400">{formatAED(totalTips)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* REVENUE MIX */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3 tracking-wider">Revenue Mix by Category</h4>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 dark:border-slate-800">
              <tr><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">% Contribution</th><th className="px-4 py-3 text-right">Net Value</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { label: 'Food', val: dsrStats.categories.Food },
                { label: 'Non-Alcoholic Bev', val: dsrStats.categories.NonAlc },
                { label: 'Alcoholic Bev', val: dsrStats.categories.Alc },
                { label: 'Retail / Other', val: dsrStats.categories.Retail }
              ].map((cat, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-bold">{cat.label}</td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {dsrStats.net > 0 ? ((cat.val / dsrStats.net) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="px-4 py-3 text-right font-black font-mono">{formatAED(cat.val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DISCOUNT ANALYSIS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm overflow-hidden">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3 tracking-wider">Discount Analysis</h4>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 dark:border-slate-800">
              <tr><th className="px-4 py-3 text-left">Campaign</th><th className="px-4 py-3 text-right">QTY</th><th className="px-4 py-3 text-right">Reduction (AED)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {discountGroups.map(([name, val], i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-bold">{name}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{val.count}</td>
                  <td className="px-4 py-3 text-right font-black font-mono">{formatAED(val.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t border-slate-200 dark:border-slate-800">
              <tr>
                <td className="px-4 py-4 uppercase text-[10px] text-slate-400">Total Reductions</td>
                <td className="px-4 py-4"></td>
                <td className="px-4 py-4 text-right text-sm">{formatAED(dsrStats.discTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-center pt-8 no-print">
        <button onClick={onExportPDF} disabled={exporting} className="bg-[#001f3f] text-white px-16 py-4 rounded-full font-black text-[11px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all disabled:opacity-50">
          {exporting ? 'Processing...' : 'Export Executive PDF Report'}
        </button>
      </div>
    </div>
  );
});

export default DSRRecap;
