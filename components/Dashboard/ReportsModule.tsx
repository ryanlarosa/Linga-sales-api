import React, { useState, useMemo } from 'react';
import { FetchedData } from '../../types';
import { exportRecapToExcel, exportAnalysisToExcel } from '../../services/excelService';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

type AnalysisDimension = 'CATEGORY' | 'DEPARTMENT' | 'HOUR' | 'FLOOR';
const COLORS = ['#e11d48', '#be123c', '#9f1239', '#fb7185', '#fda4af', '#f43f5e', '#ec4899', '#db2777'];

const parseCurrency = (val: string | undefined): number => {
    if (!val) return 0;
    return parseFloat(val.replace(/,/g, '').replace('$', '')) || 0;
};

const formatAED = (num: number) => {
  return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AED';
};

const IconExcel = () => (
  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ReportsModule: React.FC<ReportsProps> = ({ data, fromDate, toDate, selectedStoreName }) => {
  const [tab, setTab] = useState<'RECAP' | 'ANALYSIS' | 'MENU' | 'STAFF' | 'VOIDS' | 'DISCOUNTS'>('RECAP');
  const [analysisDim, setAnalysisDim] = useState<AnalysisDimension>('CATEGORY');

  // --- DERIVED DATA ---
  const dsrStats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;
    let gross = 0; let net = 0; let tax = 0; let disc = 0; let guestCount = 0;
    let covers = 0;

    data.sales.forEach(s => {
      net += parseCurrency(s.netSalesStr);
      gross += parseCurrency(s.grossAmountStr);
      tax += parseCurrency(s.totalTaxAmountStr);
      guestCount += s.guestCount;
      covers += s.guestCount;
    });

    data.saleDetails.forEach(d => {
      if (d.check !== 'Total') disc += parseCurrency(d.discountAmtStr);
    });

    // Time of day segments
    const segments = { Breakfast: 0, Lunch: 0, Dinner: 0, Late: 0 };
    const coverSegments = { Breakfast: 0, Lunch: 0, Dinner: 0, Late: 0 };
    
    data.detailedMenu.forEach(m => {
      const h = parseInt(m.orderHour);
      const val = parseCurrency(m.totalGrossAmountStr);
      if (h >= 6 && h < 11) { segments.Breakfast += val; coverSegments.Breakfast += m.quantity; }
      else if (h >= 11 && h < 16) { segments.Lunch += val; coverSegments.Lunch += m.quantity; }
      else if (h >= 16 && h < 24) { segments.Dinner += val; coverSegments.Dinner += m.quantity; }
      else { segments.Late += val; coverSegments.Late += m.quantity; }
    });

    const avgTicket = data.sales.length > 0 ? (net / data.sales.length) : 0;
    const avgGuest = guestCount > 0 ? (net / guestCount) : 0;

    return { 
      gross, net, tax, disc, guestCount, covers, avgTicket, avgGuest,
      segments, coverSegments,
      checks: data.sales.length
    };
  }, [data]);

  const flexibleData = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string, value: number, count: number }>();
    if (analysisDim === 'FLOOR') {
      data.sales.forEach(sale => {
        const floor = data.floors.find(f => f.id === sale.floorId)?.floorName || "Other";
        const curr = map.get(floor) || { name: floor, value: 0, count: 0 };
        curr.value += parseCurrency(sale.netSalesStr); curr.count += 1;
        map.set(floor, curr);
      });
    } else {
      data.detailedMenu.forEach(item => {
        let key = item.categoryName || "Uncategorized";
        if (analysisDim === 'DEPARTMENT') key = item.departmentName || "No Dept";
        if (analysisDim === 'HOUR') key = `${parseInt(item.orderHour)}:00`;
        const curr = map.get(key) || { name: key, value: 0, count: 0 };
        curr.value += parseCurrency(item.grossAmountStr); curr.count += (item.quantity || 0);
        map.set(key, curr);
      });
    }
    const res = Array.from(map.values());
    return analysisDim === 'HOUR' ? res.sort((a,b) => parseInt(a.name) - parseInt(b.name)) : res.sort((a,b) => b.value - a.value);
  }, [data, analysisDim]);

  const staffPerformance = useMemo(() => {
    if (!data || !data.sales) return [];
    const map = new Map<string, { id: string, name: string, sales: number, tickets: number, guests: number }>();
    
    data.sales.forEach(sale => {
      const empId = sale.employee;
      const empName = data.users.find(u => u.id === empId)?.name || "Unknown Staff";
      const curr = map.get(empId) || { id: empId, name: empName, sales: 0, tickets: 0, guests: 0 };
      
      curr.sales += parseCurrency(sale.netSalesStr);
      curr.tickets += 1;
      curr.guests += sale.guestCount;
      map.set(empId, curr);
    });

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [data]);

  const menuPerformance = useMemo(() => {
    if(!data?.menus) return [];
    return data.menus.map((m: any) => ({ name: m.menuName, value: parseCurrency(m.totalGrossAmountStr), count: m.quantity })).sort((a,b) => b.value - a.value);
  }, [data]);

  const voidsData = useMemo(() => {
    if (!data || !data.detailedMenu) return [];
    return data.detailedMenu.filter(item => item.isVoid === 'Y' || item.isVoid === 'true');
  }, [data]);

  const handleExportRecap = () => {
    if(!dsrStats) return;
    exportRecapToExcel({ 
      period: `${fromDate} to ${toDate}`, 
      grossSales: dsrStats.gross.toFixed(2),
      netSales: dsrStats.net.toFixed(2), 
      tax: dsrStats.tax.toFixed(2), 
      discounts: dsrStats.disc.toFixed(2), 
      guests: dsrStats.guestCount, 
      avgTicket: dsrStats.avgTicket.toFixed(2), 
      tickets: dsrStats.checks 
    }, selectedStoreName);
  };

  const handleExportTab = () => {
    if(!data) return;
    if (tab === 'ANALYSIS') exportAnalysisToExcel(flexibleData, analysisDim, selectedStoreName);
    if (tab === 'STAFF') exportAnalysisToExcel(staffPerformance.map(s => ({ name: s.name, count: s.tickets, value: s.sales })), "Staff", selectedStoreName);
    if (tab === 'MENU') exportAnalysisToExcel(menuPerformance, "MenuItem", selectedStoreName);
    if (tab === 'VOIDS') exportAnalysisToExcel(voidsData.map(v => ({ name: v.menuName, count: v.quantity, value: parseCurrency(v.totalGrossAmountStr) })), "Voids", selectedStoreName);
    if (tab === 'DISCOUNTS') exportAnalysisToExcel(data.saleDetails.filter(d => d.check !== 'Total').map(d => ({ name: d.discountName, count: d.quantity, value: parseCurrency(d.discountAmtStr) })), "Discounts", selectedStoreName);
  };

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn flex flex-col h-[calc(100vh-140px)] transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto custom-scrollbar transition-colors">
        {[
          { id: 'RECAP', label: 'DSR Recap' },
          { id: 'ANALYSIS', label: 'Advanced' },
          { id: 'MENU', label: 'Item Sales' },
          { id: 'STAFF', label: 'Staff Report' },
          { id: 'VOIDS', label: 'Voids' },
          { id: 'DISCOUNTS', label: 'Discounts' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id as any)} 
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-rose-600 text-rose-600 dark:text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
          <p className="italic">Awaiting live data stream...</p>
        </div>
      )}

      {data && (
        <div className="flex-1 overflow-auto custom-scrollbar pb-10">
          {tab === 'RECAP' && (
            dsrStats ? (
              <div className="flex flex-col gap-6 animate-fadeIn pb-12">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                    {selectedStoreName} - Daily Sales Report <span className="text-slate-400 font-medium normal-case text-sm ml-2">({fromDate})</span>
                  </h2>
                  <button onClick={handleExportRecap} className="flex items-center px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg shadow active:scale-95 transition-all">
                    <IconExcel /> Download DSR Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800 text-white p-4 rounded-lg flex flex-col gap-2">
                    <h5 className="text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 uppercase">Report Info</h5>
                    <div className="flex justify-between text-xs py-1"><span>Report Date</span><span className="font-mono">{fromDate}</span></div>
                    <div className="flex justify-between text-xs py-1"><span>Day</span><span className="font-bold">{new Date(fromDate).toLocaleDateString('en-AE', { weekday: 'long' })}</span></div>
                    <div className="flex justify-between text-xs py-1"><span>Store</span><span className="font-bold">{selectedStoreName}</span></div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex flex-col gap-2 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-white bg-slate-800 px-3 py-1.5 -mx-4 -mt-4 mb-2">Revenue Overview</h4>
                    <div className="flex justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800"><span>Gross Sales</span><span className="font-bold">{formatAED(dsrStats.gross)}</span></div>
                    <div className="flex justify-between text-xs py-1 bg-emerald-50 dark:bg-emerald-950/20 px-1 rounded font-bold"><span>Net Sales</span><span className="text-emerald-700 dark:text-emerald-400">{formatAED(dsrStats.net)}</span></div>
                    <div className="flex justify-between text-xs py-1 mt-auto font-bold border-t border-slate-100 dark:border-slate-800 pt-2"><span>Avg. Spend/ Guest</span><span className="text-rose-600">{formatAED(dsrStats.avgGuest)}</span></div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex flex-col gap-2 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-white bg-slate-800 px-3 py-1.5 -mx-4 -mt-4 mb-2">Covers Overview</h4>
                    <div className="flex justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800"><span>Check Count</span><span className="font-black">{dsrStats.checks}</span></div>
                    <div className="flex justify-between text-xs py-1 font-bold"><span>Total Covers</span><span>{dsrStats.covers}</span></div>
                    <div className="flex justify-between text-xs py-1 mt-auto font-bold border-t border-slate-100 dark:border-slate-800 pt-2"><span>Avg. Check</span><span className="text-rose-600">{formatAED(dsrStats.avgTicket)}</span></div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex flex-col gap-2 overflow-auto max-h-[180px] shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-white bg-slate-800 px-3 py-1.5 -mx-4 -mt-4 mb-2">Discounts</h4>
                    <div className="flex justify-between text-[11px] font-bold py-1 mb-1 text-rose-600"><span>Total Discount</span><span>{formatAED(dsrStats.disc)}</span></div>
                    {data.saleDetails.filter(d => d.check !== 'Total' && parseCurrency(d.discountAmtStr) > 0).map((d, i) => (
                      <div key={i} className="flex justify-between text-[10px] py-1 text-slate-500 border-t border-slate-100 dark:border-slate-800">
                        <span className="truncate pr-2">{d.discountName}</span>
                        <span>{formatAED(parseCurrency(d.discountAmtStr))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                  <h4 className="text-[10px] font-black uppercase text-white bg-slate-800 px-4 py-2">Revenue Contribution by Period</h4>
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold text-slate-500">
                      <tr><th className="px-4 py-2.5 text-left">Segment</th><th className="px-4 py-2.5 text-right">Revenue (AED)</th><th className="px-4 py-2.5 text-right">Covers</th><th className="px-4 py-2.5 text-right">Avg / Guest</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        { label: 'Breakfast', rev: dsrStats.segments.Breakfast, cov: dsrStats.coverSegments.Breakfast },
                        { label: 'Lunch', rev: dsrStats.segments.Lunch, cov: dsrStats.coverSegments.Lunch },
                        { label: 'Dinner', rev: dsrStats.segments.Dinner, cov: dsrStats.coverSegments.Dinner },
                        { label: 'Other', rev: dsrStats.segments.Late, cov: dsrStats.coverSegments.Late }
                      ].map((seg, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-bold">{seg.label}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatAED(seg.rev)}</td>
                          <td className="px-4 py-3 text-right">{seg.cov}</td>
                          <td className="px-4 py-3 text-right font-medium text-rose-600">{seg.cov > 0 ? formatAED(seg.rev / seg.cov) : '0.00 AED'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                No sales transactions found for this period.
              </div>
            )
          )}

          {tab === 'STAFF' && (
            <div className="flex flex-col flex-1 animate-fadeIn gap-6">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold uppercase text-slate-400">Staff Sales Performance</h3>
                <button onClick={handleExportTab} className="flex items-center px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg shadow"><IconExcel /> Export Staff Report</button>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr><th className="px-6 py-4">Employee Name</th><th className="px-6 py-4 text-right">Tickets</th><th className="px-6 py-4 text-right">Total Net Sales</th><th className="px-6 py-4 text-right">Covers</th><th className="px-6 py-4 text-right font-bold text-rose-600">Avg / Ticket</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffPerformance.length > 0 ? staffPerformance.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-rose-600 text-[10px]">{row.name.charAt(0)}</div><span className="font-semibold dark:text-slate-200">{row.name}</span></div></td>
                        <td className="px-6 py-4 text-right dark:text-slate-400">{row.tickets}</td>
                        <td className="px-6 py-4 text-right font-bold">{formatAED(row.sales)}</td>
                        <td className="px-6 py-4 text-right">{row.guests}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600">{row.tickets > 0 ? formatAED(row.sales / row.tickets) : '0.00 AED'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No staff performance data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'MENU' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-1 flex flex-col shadow-sm animate-fadeIn">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Menu Breakdown</h3>
                <button onClick={handleExportTab} className="flex items-center px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-all hover:bg-rose-700"><IconExcel /> Export List</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr><th className="px-6 py-4">Item</th><th className="px-6 py-4 text-right">Sold</th><th className="px-6 py-4 text-right">Total (AED)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {menuPerformance.length > 0 ? menuPerformance.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-4 font-medium dark:text-slate-200">{item.name}</td>
                        <td className="px-6 py-4 text-right dark:text-slate-400">{item.count}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-700 dark:text-rose-400">{formatAED(item.value)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No menu items sold in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'VOIDS' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-1 flex flex-col shadow-sm animate-fadeIn">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-bold text-rose-600 uppercase">Voids Report</h3>
                <button onClick={handleExportTab} className="flex items-center px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-all hover:bg-rose-700"><IconExcel /> Export Voids</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr><th className="px-6 py-4">Item</th><th className="px-6 py-4">Reason / Employee</th><th className="px-6 py-4 text-right">Qty</th><th className="px-6 py-4 text-right">Value</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {voidsData.length > 0 ? voidsData.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium dark:text-slate-200">{v.menuName}</td>
                        <td className="px-6 py-4">
                          <p className="text-rose-500 font-bold">{v.voidError || "No Reason"}</p>
                          <p className="text-[10px] text-slate-400 uppercase">By: {v.voidByEmployee || "System"}</p>
                        </td>
                        <td className="px-6 py-4 text-right">{v.quantity}</td>
                        <td className="px-6 py-4 text-right font-bold">{formatAED(parseCurrency(v.totalGrossAmountStr))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No void transactions recorded for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'DISCOUNTS' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex-1 flex flex-col shadow-sm animate-fadeIn">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase">Discount Summary</h3>
                <button onClick={handleExportTab} className="flex items-center px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg transition-all hover:bg-rose-700"><IconExcel /> Export Discounts</button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Reason / Applied By</th><th className="px-6 py-4 text-right">Value</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.saleDetails.filter(d => d.check !== 'Total').length > 0 ? data.saleDetails.filter(d => d.check !== 'Total').map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium dark:text-slate-200">{d.discountName}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-600 dark:text-slate-300">{d.reason || "General Promo"}</p>
                          <p className="text-[10px] text-slate-400 uppercase">By: {d.discountAppliedBy || "System"}</p>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600">{formatAED(parseCurrency(d.discountAmtStr))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No discounts applied in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'ANALYSIS' && (
            <div className="flex flex-col flex-1 gap-6 min-h-0 animate-fadeIn">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pivot:</span>
                  <div className="flex bg-slate-50 dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
                    {['CATEGORY', 'DEPARTMENT', 'HOUR', 'FLOOR'].map((d: any) => (
                      <button key={d} onClick={() => setAnalysisDim(d)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${analysisDim === d ? 'bg-rose-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{d}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleExportTab} className="flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-all"><IconExcel /> Export Advanced</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col min-h-[300px] shadow-sm transition-colors">
                  <ResponsiveContainer width="100%" height="100%">
                    {['HOUR', 'FLOOR'].includes(analysisDim) ? (
                      <BarChart data={flexibleData}><XAxis dataKey="name" tick={{fontSize: 9}}/><YAxis tick={{fontSize: 9}}/><Tooltip formatter={(v: number) => formatAED(v)} /><Bar dataKey="value" fill="#e11d48" radius={[4, 4, 0, 0]} /></BarChart>
                    ) : (
                      <PieChart><Pie data={flexibleData} dataKey="value" cx="50%" cy="50%" outerRadius={80}>{flexibleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatAED(v)} /><Legend/></PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-slate-800">
                      <tr><th className="px-6 py-4">Label</th><th className="px-6 py-4 text-right">Qty</th><th className="px-6 py-4 text-right">Value (AED)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {flexibleData.length > 0 ? flexibleData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-semibold dark:text-slate-200">{row.name}</td>
                          <td className="px-6 py-4 text-right dark:text-slate-400">{row.count}</td>
                          <td className="px-6 py-4 text-right font-bold text-rose-700 dark:text-rose-400">{formatAED(row.value)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No analysis data for this dimension.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsModule;