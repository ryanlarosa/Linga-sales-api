
import React from 'react';
import { formatAED } from './ReportUtils';

interface ItemPerformanceProps {
  menuPerformance: any[];
  onExportExcel: () => void;
}

const ItemPerformance: React.FC<ItemPerformanceProps> = ({ menuPerformance, onExportExcel }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Product Velocity Metrics</h3>
        <button onClick={onExportExcel} className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg">Export Sheet (Excel)</button>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
          <tr><th className="px-6 py-5">Product Name</th><th className="text-right px-6 py-5">Units Sold</th><th className="text-right px-6 py-5">Net Sales (AED)</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {menuPerformance.map((item, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{item.name}</td>
              <td className="px-6 py-4 text-right font-bold text-slate-400">{item.count}</td>
              <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAED(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemPerformance;
