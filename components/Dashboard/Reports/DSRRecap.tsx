
import React, { forwardRef, useMemo } from 'react';
import { FetchedData, PaymentSummaryItem } from '../../../types';
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
  
  // Categorization Logic for Settlement Summary Sections
  const { creditCards, otherPayments } = useMemo(() => {
    const ccKeywords = ['visa', 'master', 'amex', 'qlub', 'credit', 'cc'];
    const ccs: PaymentSummaryItem[] = [];
    const others: PaymentSummaryItem[] = [];

    (data.paymentSummary || []).forEach(p => {
      const nameLower = p.name.toLowerCase();
      const typeLower = (p.type || '').toLowerCase();
      if (ccKeywords.some(k => nameLower.includes(k) || typeLower.includes('cc'))) {
        ccs.push(p);
      } else {
        others.push(p);
      }
    });

    return { creditCards: ccs, otherPayments: others };
  }, [data.paymentSummary]);

  // Totals for Section Footers
  const ccTotals = useMemo(() => ({
    count: creditCards.reduce((acc, p) => acc + p.count, 0),
    amount: creditCards.reduce((acc, p) => acc + p.amount, 0),
    tips: creditCards.reduce((acc, p) => acc + p.tips, 0)
  }), [creditCards]);

  const otherTotals = useMemo(() => ({
    count: otherPayments.reduce((acc, p) => acc + p.count, 0),
    amount: otherPayments.reduce((acc, p) => acc + p.amount, 0),
    tips: otherPayments.reduce((acc, p) => acc + p.tips, 0)
  }), [otherPayments]);

  // Grouping for the final "PAYMENT SUMMARY" block (By Type)
  const footerSummary = useMemo(() => {
    const summaryMap = new Map<string, number>();
    (data.paymentSummary || []).forEach(p => {
        const typeLabel = p.type || 'OTHER PAYMENT';
        const current = summaryMap.get(typeLabel) || 0;
        summaryMap.set(typeLabel, current + p.amount);
    });
    return Array.from(summaryMap.entries());
  }, [data.paymentSummary]);

  const grandTotalAmount = ccTotals.amount + otherTotals.amount;
  const grandTotalTips = ccTotals.tips + otherTotals.tips;
  const grandTotalSettled = grandTotalAmount + grandTotalTips;

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
      {/* EXECUTIVE HEADER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2">Report Context</h4>
          <div className="p-4 space-y-2">
            <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">For the Day</span>
              <span className="text-[11px] font-black text-slate-900 dark:text-white">{fromDate}</span>
            </div>
            <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Day</span>
              <span className="text-[11px] font-black text-slate-900 dark:text-white">{dayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Store</span>
              <span className="text-[11px] font-black text-rose-600">{selectedStoreName}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2">Management</h4>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">MOD</span>
              <input value={modName} onChange={e => setModName(e.target.value)} className="text-[11px] font-black text-right bg-transparent border-b border-dashed border-slate-200 focus:border-rose-500 outline-none w-24 no-print" />
              <span className="text-[11px] font-black text-right print-only hidden">{modName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">BOH</span>
              <input value={bohName} onChange={e => setBohName(e.target.value)} className="text-[11px] font-black text-right bg-transparent border-b border-dashed border-slate-200 focus:border-rose-500 outline-none w-24 no-print" />
              <span className="text-[11px] font-black text-right print-only hidden">{bohName}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2">Revenue Overview</h4>
          <div className="p-4 space-y-2">
            <div className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Gross - Day</span>
              <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatAED(dsrStats.gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Net - Day</span>
              <span className="text-[11px] font-black text-rose-600">{formatAED(dsrStats.net)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Gross Revenue (Receipt)</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">{formatAED(dsrStats.gross)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Total Tax</p>
          <h3 className="text-xl font-black text-slate-600 dark:text-slate-300">{formatAED(dsrStats.tax)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Discount</p>
          <h3 className="text-xl font-black text-slate-700 dark:text-slate-200">{formatAED(dsrStats.discTotal)}</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Checks / Covers</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">{dsrStats.checks} / {dsrStats.guestCount}</h3>
          <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold tracking-tight">Avg {formatAED(dsrStats.avgGuest)}</p>
        </div>
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border border-slate-800">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Net Sales</p>
          <h3 className="text-xl font-black">{formatAED(dsrStats.net)}</h3>
        </div>
      </div>

      {/* TABLES ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm h-fit">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Net Revenue Split - Venue Level</h4>
          <table className="w-full text-[11px]">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr className="bg-slate-50 dark:bg-slate-950/40 font-black">
                <td className="px-4 py-4">Actual (Today)</td>
                <td className="px-4 py-4 text-right text-base text-rose-600">{formatAED(dsrStats.net)}</td>
                <td className="px-4 py-4 text-right text-base">
                  <div className="flex flex-col text-[10px] text-slate-500 text-right">
                    <span className="font-bold">{dsrStats.checks} Checks</span>
                    <span className="font-bold">{dsrStats.guestCount} Covers</span>
                  </div>
                </td>
              </tr>
              <tr className="font-bold">
                <td className="px-4 py-4 text-slate-400 uppercase tracking-tighter">Operational Target</td>
                <td className="px-4 py-4 text-right">
                  <input type="number" value={operationalTarget || ''} onChange={(e) => setOperationalTarget(parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-32 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-700 text-right focus:border-rose-500 outline-none px-2 py-1 font-mono text-xs transition-colors no-print" />
                  <span className="print-only hidden font-mono">{operationalTarget}</span>
                </td>
                <td className="px-4 py-4 text-right font-medium text-slate-400">Target Line</td>
              </tr>
              <tr className={`font-black bg-slate-50/20 dark:bg-slate-900/50`}>
                <td className="px-4 py-4 uppercase tracking-widest text-[9px]">Target Variance</td>
                <td className="px-4 py-4 text-right text-slate-900 dark:text-white font-mono">{formatAED(variance)}</td>
                <td className="px-4 py-4 text-right text-slate-500">{variancePct.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Revenue Mix by Category</h4>
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase text-[9px]">
              <tr><th className="px-4 py-3 text-left">Category</th><th className="text-right px-4">% Contribution</th><th className="text-right px-4">Net Value</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { label: 'Food', val: dsrStats.categories.Food },
                { label: 'Non-Alcoholic Bev', val: dsrStats.categories.NonAlc },
                { label: 'Alcoholic Bev', val: dsrStats.categories.Alc },
                { label: 'Retail / Other', val: dsrStats.categories.Retail }
              ].map((cat, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold">{cat.label}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-400">
                    {dsrStats.net > 0 ? ((cat.val / dsrStats.net) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="px-4 py-3 text-right font-black font-mono">{formatAED(cat.val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLES ROW 2: CATEGORIZED SETTLEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Settlement Summary</h4>
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase text-[9px]">
              <tr>
                <th className="px-4 py-3 text-left">Tender Type</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Amt</th>
                <th className="px-4 py-3 text-right">Tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* CREDIT CARD SECTION */}
              <tr className="bg-slate-50 dark:bg-slate-950 font-black text-slate-400 text-[9px] uppercase tracking-widest"><td colSpan={4} className="px-4 py-2">Credit Card</td></tr>
              {creditCards.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold">{p.name}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{p.count}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatAED(p.amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatAED(p.tips)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/50 font-black"><td className="px-4 py-2">Total Credit Card</td><td className="text-right px-4 py-2">{ccTotals.count}</td><td className="text-right px-4 py-2">{formatAED(ccTotals.amount)}</td><td className="text-right px-4 py-2 text-emerald-600">{formatAED(ccTotals.tips)}</td></tr>

              {/* OTHER PAYMENT SECTION */}
              <tr className="bg-slate-50 dark:bg-slate-950 font-black text-slate-400 text-[9px] uppercase tracking-widest pt-4"><td colSpan={4} className="px-4 py-2">Other Payment(s)</td></tr>
              {otherPayments.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-bold">{p.name}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{p.count}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatAED(p.amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatAED(p.tips)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50/50 font-black"><td className="px-4 py-2">Total Other</td><td className="text-right px-4 py-2">{otherTotals.count}</td><td className="text-right px-4 py-2">{formatAED(otherTotals.amount)}</td><td className="text-right px-4 py-2 text-emerald-600">{formatAED(otherTotals.tips)}</td></tr>
            </tbody>

            {/* PAYMENT SUMMARY BLOCK (Matches Linga Report Footer) */}
            <tfoot className="bg-[#001f3f] text-white border-t border-slate-200 dark:border-slate-800 font-black">
                <tr className="text-[9px] font-black uppercase tracking-widest bg-slate-900/40"><td colSpan={4} className="px-4 py-2 text-slate-300 tracking-tighter">Payment Summary (Grouped by Type)</td></tr>
                {footerSummary.map(([type, totalAmt], idx) => (
                   <tr key={idx} className="border-t border-white/5">
                        <td className="px-4 py-2 uppercase text-[10px]">{type}</td>
                        <td colSpan={2}></td>
                        <td className="text-right px-4 py-2">{formatAED(totalAmt)}</td>
                   </tr>
                ))}
                <tr className="border-t border-rose-500 bg-rose-600">
                    <td className="px-4 py-3 text-xs uppercase">Grand Total Settlement</td>
                    <td colSpan={2}></td>
                    <td className="text-right px-4 py-3 text-xs">{formatAED(grandTotalSettled)}</td>
                </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Discount Analysis</h4>
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase text-[9px]">
              <tr><th className="px-4 py-3 text-left">Campaign</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Reduction (AED)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {discountGroups.length > 0 ? (
                discountGroups.map(([name, val], i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-bold">{name}</td>
                    <td className="px-4 py-3 text-right text-slate-400 font-bold">{val.count}</td>
                    <td className="px-4 py-3 text-right font-black font-mono">{formatAED(val.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No discounts applied</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 font-black">
              <tr><td className="px-4 py-4 text-[10px] uppercase tracking-wider">Total Reductions</td><td className="px-4 py-4"></td><td className="px-4 py-4 text-right text-base text-slate-800 dark:text-slate-100">{formatAED(dsrStats.discTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-center pt-8 no-print">
        <button onClick={onExportPDF} disabled={exporting} className="flex items-center px-12 py-5 bg-slate-900 text-white text-xs font-black rounded-full shadow-2xl hover:bg-slate-800 hover:scale-[1.02] transition-all uppercase tracking-[0.2em] active:scale-95 disabled:opacity-50">
          {exporting ? 'Generating Document...' : 'Export Executive PDF Report'}
        </button>
      </div>
    </div>
  );
});

export default DSRRecap;
