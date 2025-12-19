
import React from 'react';
import { formatAED } from './ReportUtils';

interface StaffMetricsProps {
  metrics: any[];
}

const StaffMetrics: React.FC<StaffMetricsProps> = ({ metrics }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 font-black text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 tracking-widest">Employee Performance Consolidated</div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
          <tr><th className="px-6 py-5">Employee Name</th><th className="text-right px-6 py-5">Checks</th><th className="text-right px-6 py-5">Covers</th><th className="text-right px-6 py-5">Net Sales (AED)</th><th className="text-right px-6 py-5">Avg Spend/Cover</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {metrics.map((s, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{s.name}</td>
              <td className="px-6 py-4 text-right font-bold text-slate-400">{s.checks}</td>
              <td className="px-6 py-4 text-right font-bold text-slate-400">{s.covers}</td>
              <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAED(s.netSales)}</td>
              <td className="px-6 py-4 text-right font-bold text-rose-600">{s.covers > 0 ? formatAED(s.netSales / s.covers) : '0 AED'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StaffMetrics;
