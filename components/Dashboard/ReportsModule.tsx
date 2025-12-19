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
  return num.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' AED';
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
    let totalPayments = 0;

    data.sales.forEach(s => {
      net += parseCurrency(s.netSalesStr);
      gross += parseCurrency(s.grossAmountStr);
      tax += parseCurrency(s.totalTaxAmountStr);
      guestCount += s.guestCount;
      // Using gross receipt as a proxy for total payments processed
      totalPayments += parseCurrency(s.grossReceiptStr) || (parseCurrency(s.netSalesStr) + parseCurrency(s.totalTaxAmountStr));
    });

    data.saleDetails.forEach(d => {
      if (d.check !== 'Total') disc += parseCurrency(d.discountAmtStr);
    });

    // Segment Logic (Time of Day)
    const segments = { Breakfast: 0, Lunch: 0, Dinner: 0, Other: 0 };
    const coverSegments = { Breakfast: 0, Lunch: 0, Dinner: 0, Other: 0 };
    
    data.detailedMenu.forEach(m => {
      const h = parseInt(m.orderHour);
      const val = parseCurrency(m.totalGrossAmountStr);
      if (h >= 6 && h < 11) { segments.Breakfast += val; coverSegments.Breakfast += m.quantity; }
      else if (h >= 11 && h < 16) { segments.Lunch += val; coverSegments.Lunch += m.quantity; }
      else if (h >= 16 && h < 24) { segments.Dinner += val; coverSegments.Dinner += m.quantity; }
      else { segments.Other += val; coverSegments.Other += m.quantity; }
    });

    // Category Logic (Food vs Bev)
    const categories = { Food: 0, NonAlc: 0, Alc: 0, Retail: 0 };
    data.detailedMenu.forEach(m => {
        const val = parseCurrency(m.totalGrossAmountStr);
        const dept = (m.departmentName || '').toLowerCase();
        if (dept.includes('food')) categories.Food += val;
        else if (dept.includes('bev') || dept.includes('drink')) {
            if (dept.includes('wine') || dept.includes('alc')) categories.Alc += val;
            else categories.NonAlc += val;
        } else {
            categories.Retail += val;
        }
    });

    const avgTicket = data.sales.length > 0 ? (net / data.sales.length) : 0;
    const avgGuest = guestCount > 0 ? (net / guestCount) : 0;

    return { 
      gross, net, tax, disc, guestCount, avgTicket, avgGuest,
      segments, coverSegments, categories, totalPayments,
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
  };

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn flex flex-col h-[calc(100vh-140px)] transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto custom-scrollbar transition-colors">
        {[
          { id: 'RECAP', label: 'DSR Recap' },
          { id: 'ANALYSIS', label: 'Advanced Pivot' },
          { id: 'MENU', label: 'Item Sales' },
          { id: 'STAFF', label: 'Staff' },
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
          <p className="italic font-medium">Processing DSR Ledger...</p>
        </div>
      )}

      {data && (
        <div className="flex-1 overflow-auto custom-scrollbar pb-10">
          {tab === 'RECAP' && (
            dsrStats ? (
              <div className="flex flex-col gap-8 animate-fadeIn pb-12">
                
                {/* 1. TOP SUMMARY CARDS (DISCOUNTS & PAYMENTS) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Gross Revenue</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">{formatAED(dsrStats.gross)}</h3>
                        <p className="text-[10px] text-slate-400 mt-2">Total inclusive of tax & disc</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-rose-600 mb-2 tracking-widest">Total Discounts</p>
                        <h3 className="text-3xl font-black text-rose-600">{formatAED(dsrStats.disc)}</h3>
                        <p className="text-[10px] text-rose-400 mt-2">Value of complimentary items</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        <p className="text-[10px] font-black uppercase text-emerald-600 mb-2 tracking-widest">Total Payments</p>
                        <h3 className="text-3xl font-black text-emerald-600">{formatAED(dsrStats.totalPayments)}</h3>
                        <p className="text-[10px] text-emerald-400 mt-2">Consolidated receipts</p>
                    </div>
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Net Revenue</p>
                        <h3 className="text-3xl font-black">{formatAED(dsrStats.net)}</h3>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                             <span className="text-[10px] uppercase font-bold text-slate-500">Avg / Guest</span>
                             <span className="text-sm font-black text-rose-500">{formatAED(dsrStats.avgGuest)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* 2. VENUE LEVEL SPLIT (LEFT) */}
                  <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm h-fit">
                    <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2.5">Net Revenue Split - Venue Level</h4>
                    <table className="w-full text-[11px]">
                        <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-4 py-2 text-left">For the Day</th>
                                <th className="px-4 py-2 text-right">Net Revenue</th>
                                <th className="px-4 py-2 text-right">Covers</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr className="bg-slate-50 dark:bg-slate-950/40 font-black">
                                <td className="px-4 py-3">Actual</td>
                                <td className="px-4 py-3 text-right text-base text-rose-600">{formatAED(dsrStats.net)}</td>
                                <td className="px-4 py-3 text-right text-base">{dsrStats.guestCount}</td>
                            </tr>
                            <tr className="text-slate-400">
                                <td className="px-4 py-3 italic">Budget/Target</td>
                                <td className="px-4 py-3 text-right">-</td>
                                <td className="px-4 py-3 text-right">-</td>
                            </tr>
                            <tr className="text-slate-400">
                                <td className="px-4 py-3 italic">Variance</td>
                                <td className="px-4 py-3 text-right">-</td>
                                <td className="px-4 py-3 text-right">-</td>
                            </tr>
                        </tbody>
                    </table>
                  </div>

                  {/* 3. REVENUE CONTRIBUTION (RIGHT) */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <div className="flex bg-[#001f3f] text-white">
                            <h4 className="text-[10px] font-black uppercase px-4 py-2.5 flex-1">Revenue Contribution</h4>
                            <div className="flex text-[10px] uppercase font-bold items-center pr-4 gap-6 text-slate-400">
                                <span>For the Day</span>
                            </div>
                        </div>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-2 text-left">Period</th>
                                    <th className="px-4 py-2 text-right">Breakfast</th>
                                    <th className="px-4 py-2 text-right">Lunch</th>
                                    <th className="px-4 py-2 text-right">Dinner</th>
                                    <th className="px-4 py-2 text-right">Other</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr className="font-bold">
                                    <td className="px-4 py-3 bg-slate-50 dark:bg-slate-950">Net Revenue</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatAED(dsrStats.segments.Breakfast)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatAED(dsrStats.segments.Lunch)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatAED(dsrStats.segments.Dinner)}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatAED(dsrStats.segments.Other)}</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 bg-slate-50 dark:bg-slate-950">Covers</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.coverSegments.Breakfast}</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.coverSegments.Lunch}</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.coverSegments.Dinner}</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.coverSegments.Other}</td>
                                </tr>
                                <tr className="bg-slate-100 dark:bg-slate-800/50 font-black">
                                    <td className="px-4 py-3">Avg. Spend</td>
                                    <td className="px-4 py-3 text-right text-rose-600">{dsrStats.coverSegments.Breakfast > 0 ? formatAED(dsrStats.segments.Breakfast/dsrStats.coverSegments.Breakfast) : '0 AED'}</td>
                                    <td className="px-4 py-3 text-right text-rose-600">{dsrStats.coverSegments.Lunch > 0 ? formatAED(dsrStats.segments.Lunch/dsrStats.coverSegments.Lunch) : '0 AED'}</td>
                                    <td className="px-4 py-3 text-right text-rose-600">{dsrStats.coverSegments.Dinner > 0 ? formatAED(dsrStats.segments.Dinner/dsrStats.coverSegments.Dinner) : '0 AED'}</td>
                                    <td className="px-4 py-3 text-right text-rose-600">{dsrStats.coverSegments.Other > 0 ? formatAED(dsrStats.segments.Other/dsrStats.coverSegments.Other) : '0 AED'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                  </div>
                </div>

                {/* 4. LOWER GRID: TOP SELLERS & CATEGORY MIX */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* TOP SELLERS */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2.5 flex justify-between">
                            <span>Top Sellers by Net Sales</span>
                            <span className="text-slate-400 font-bold">Rev Contribution</span>
                        </h4>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800 uppercase">
                                <tr>
                                    <th className="px-4 py-2 text-left">Item / Quantity</th>
                                    <th className="px-4 py-2 text-right">Value</th>
                                    <th className="px-4 py-2 text-right">% Net</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.detailedMenu.sort((a,b) => parseCurrency(b.totalGrossAmountStr) - parseCurrency(a.totalGrossAmountStr)).slice(0, 6).map((item, i) => {
                                    const val = parseCurrency(item.totalGrossAmountStr);
                                    const pct = dsrStats.net > 0 ? ((val / dsrStats.net) * 100).toFixed(0) : '0';
                                    return (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-2.5">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{item.menuName}</p>
                                                <p className="text-[10px] text-slate-400">{item.quantity} Qty</p>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-black">{formatAED(val)}</td>
                                            <td className="px-4 py-2.5 text-right font-bold text-slate-500">{pct}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* CATEGORY MIX TABLE */}
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-2.5">Net Revenue by Item Category</h4>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-2 text-left">For the Day</th>
                                    <th className="px-4 py-2 text-right">Food</th>
                                    <th className="px-4 py-2 text-right">Non-Alc Bev</th>
                                    <th className="px-4 py-2 text-right">Alc Bev</th>
                                    <th className="px-4 py-2 text-right">Retail/Other</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr className="bg-slate-100 dark:bg-slate-800/50 font-bold">
                                    <td className="px-4 py-3">Revenue Mix %</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.net > 0 ? (dsrStats.categories.Food / dsrStats.net * 100).toFixed(0) : 0}%</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.net > 0 ? (dsrStats.categories.NonAlc / dsrStats.net * 100).toFixed(0) : 0}%</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.net > 0 ? (dsrStats.categories.Alc / dsrStats.net * 100).toFixed(0) : 0}%</td>
                                    <td className="px-4 py-3 text-right">{dsrStats.net > 0 ? (dsrStats.categories.Retail / dsrStats.net * 100).toFixed(0) : 0}%</td>
                                </tr>
                                <tr className="font-black">
                                    <td className="px-4 py-4">Actual (AED)</td>
                                    <td className="px-4 py-4 text-right">{formatAED(dsrStats.categories.Food)}</td>
                                    <td className="px-4 py-4 text-right">{formatAED(dsrStats.categories.NonAlc)}</td>
                                    <td className="px-4 py-4 text-right">{formatAED(dsrStats.categories.Alc)}</td>
                                    <td className="px-4 py-4 text-right">{formatAED(dsrStats.categories.Retail)}</td>
                                </tr>
                                <tr className="text-slate-400">
                                    <td className="px-4 py-2 italic">Target Variance</td>
                                    <td className="px-4 py-2 text-right">-</td>
                                    <td className="px-4 py-2 text-right">-</td>
                                    <td className="px-4 py-2 text-right">-</td>
                                    <td className="px-4 py-2 text-right">-</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <div>For Tomorrow: Sale Target: TBD</div>
                            <div>Last Year Comparable Sale: TBD</div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM FOOTER RECAP ACTION */}
                <div className="flex justify-center pt-8">
                     <button onClick={handleExportRecap} className="flex items-center px-10 py-4 bg-slate-900 text-white text-xs font-black rounded-full shadow-2xl hover:bg-rose-600 transition-all uppercase tracking-widest">
                        <IconExcel /> Export Professional DSR (Excel)
                    </button>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                No active sales data for this period.
              </div>
            )
          )}

          {/* Fallbacks for other tabs to prevent crashes */}
          {tab !== 'RECAP' && (
             <div className="py-20 text-center text-slate-400 italic">
                 Tab "{tab}" details are currently under operational refinement.
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsModule;