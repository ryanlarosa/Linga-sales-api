
import React from 'react';
import { FetchedData } from '../../../types';
import { formatAED, parseCurrency } from './ReportUtils';

interface VoidLogProps {
  voids: any[];
  data: FetchedData;
}

const VoidLog: React.FC<VoidLogProps> = ({ voids, data }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 font-black text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 tracking-widest">System Void Log</div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
          <tr><th className="px-6 py-5">Ticket #</th><th className="px-6 py-5">Item Name</th><th className="text-right px-6 py-5">Qty</th><th className="px-6 py-5">Reason</th><th className="px-6 py-5">Voided By</th><th className="text-right px-6 py-5">Value</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {voids.length > 0 ? voids.map((v, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 font-mono font-bold text-slate-500">{v.saleId}</td>
              <td className="px-6 py-4 font-bold dark:text-white">{v.menuName}</td>
              <td className="px-6 py-4 text-right font-bold">{v.quantity}</td>
              <td className="px-6 py-4 text-slate-500 italic font-medium">{v.voidError || 'No reason provided'}</td>
              <td className="px-6 py-4 font-bold">{data.users.find(u => u.id === v.voidByEmployee)?.name || 'Manager'}</td>
              <td className="px-6 py-4 text-right font-black text-rose-600">{formatAED(parseCurrency(v.totalGrossAmountStr))}</td>
            </tr>
          )) : (
            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic font-medium">No void records found for this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default VoidLog;
