
import React from 'react';
import { formatAED, parseCurrency } from './ReportUtils';

interface DiscountLedgerProps {
  discounts: any[];
}

const DiscountLedger: React.FC<DiscountLedgerProps> = ({ discounts }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 font-black text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 tracking-widest">Discount Activity Ledger</div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="px-6 py-5">Ticket #</th>
            <th className="px-6 py-5">Campaign</th>
            <th className="px-6 py-5 text-right">Qty</th>
            <th className="px-6 py-5 text-right">Reduction</th>
            <th className="px-6 py-5">Reason</th>
            <th className="px-6 py-5">Applied By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {discounts.length > 0 ? discounts.map((d, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 font-mono font-bold text-slate-400 uppercase tracking-tighter">{d.check}</td>
              <td className="px-6 py-4 font-bold dark:text-white">{d.discountName}</td>
              <td className="px-6 py-4 text-right font-bold text-slate-400">{d.quantity}</td>
              <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAED(parseCurrency(d.discountAmtStr))}</td>
              <td className="px-6 py-4 text-slate-500 italic font-medium">{d.reason || '-'}</td>
              <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{d.discountAppliedBy}</td>
            </tr>
          )) : (
            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic font-medium">No discounts recorded in this range.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DiscountLedger;
