import React, { useState, useMemo, useRef } from "react";
import { FetchedData } from "../../types";
import { exportAnalysisToExcel } from "../../services/excelService";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { 
  TrendingUp, Users, FileText, Gift, Trash2, ShieldAlert, Award, Clock, DollarSign, Download
} from 'lucide-react';

import { parseCurrency, formatAED } from "./Reports/ReportUtils";

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

const COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

const ReportsModule: React.FC<ReportsProps> = ({
  data,
  fromDate,
  selectedStoreName,
}) => {
  const [operationalTarget, setOperationalTarget] = useState<number>(0);
  const [modName, setModName] = useState("MANAGER");
  const [bohName, setBohName] = useState("CHEF");
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- DERIVED STATS ---
  const stats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;
    let grossReceiptSum = 0;
    let net = 0;
    let tax = 0;
    let discTotal = 0;
    let guestCount = 0;
    let totalTips = 0;

    const segments: Record<string, { revenue: number; covers: number; checks: number }> = {
      Breakfast: { revenue: 0, covers: 0, checks: 0 },
      Lunch: { revenue: 0, covers: 0, checks: 0 },
      Dinner: { revenue: 0, covers: 0, checks: 0 },
      Other: { revenue: 0, covers: 0, checks: 0 },
    };

    data.sales.forEach((s) => {
      const netVal = parseCurrency(s.netSalesStr);
      const taxVal = parseCurrency(s.totalTaxAmountStr);
      const grossReceipt = parseCurrency(s.grossReceiptStr);

      net += netVal;
      tax += taxVal;
      grossReceiptSum += grossReceipt;
      guestCount += s.guestCount || 0;

      const dateObj = new Date(s.saleOpenTime);
      const h = isNaN(dateObj.getTime())
        ? parseInt(s.saleOpenTime.split(":")[0])
        : dateObj.getHours();

      let seg = "Other";
      if (h >= 6 && h < 11) seg = "Breakfast";
      else if (h >= 11 && h < 16) seg = "Lunch";
      else if (h >= 16 && h < 24) seg = "Dinner";

      segments[seg].revenue += netVal;
      segments[seg].covers += s.guestCount || 0;
      segments[seg].checks += 1;
    });

    data.saleDetails.forEach((d) => {
      if (d.check !== "Total") {
        discTotal += parseCurrency(d.discountAmtStr);
      }
    });

    if (data.paymentSummary) {
      data.paymentSummary.forEach((p) => {
        totalTips += p.tips || 0;
      });
    }

    const departmentMix: Record<string, number> = {};
    data.detailedMenu.forEach((m) => {
      const val = parseCurrency(m.totalGrossAmountStr);
      const dept = m.departmentName || "Unassigned";
      departmentMix[dept] = (departmentMix[dept] || 0) + val;
    });

    const voids = data.detailedMenu.filter(
      (item) => item.isVoid === "Y" || item.isVoid === "true"
    );
    const totalVoidsVal = voids.reduce((acc, curr) => acc + parseCurrency(curr.grossAmountStr), 0);

    const avgGuest = guestCount > 0 ? net / guestCount : 0;
    const avgCheck = data.sales.length > 0 ? net / data.sales.length : 0;

    // Segment data for pie chart
    const segmentChartData = Object.entries(segments)
      .map(([name, val]) => ({ name, value: Math.round(val.revenue) }))
      .filter(item => item.value > 0);

    // Department mix for bar chart
    const departmentChartData = Object.entries(departmentMix)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Top selling items
    const menuMap = new Map<string, { name: string; count: number; gross: number }>();
    data.detailedMenu.forEach((m) => {
      const curr = menuMap.get(m.menuName) || { name: m.menuName, count: 0, gross: 0 };
      curr.count += m.quantity || 0;
      curr.gross += parseCurrency(m.totalGrossAmountStr);
      menuMap.set(m.menuName, curr);
    });
    const topItems = Array.from(menuMap.values())
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 5);

    return {
      gross: grossReceiptSum,
      net,
      tax,
      discTotal,
      guestCount,
      avgGuest,
      avgCheck,
      totalTips,
      totalVoidsVal,
      voidsCount: voids.length,
      checksCount: data.sales.length,
      segmentChartData,
      departmentChartData,
      topItems
    };
  }, [data]);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: isDark ? "#020617" : "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Executive_Summary_${selectedStoreName}_${fromDate}.pdf`);
    } catch (err) {
      console.error("PDF Export Failed:", err);
    } finally {
      setExporting(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 py-20">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
        <p className="italic font-medium">Synchronizing Cloud Data...</p>
      </div>
    );
  }

  const variance = (stats?.net || 0) - operationalTarget;
  const variancePct = operationalTarget > 0 ? (variance / operationalTarget) * 100 : 0;

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn pb-12" ref={dashboardRef}>
      {/* Upper Control Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h3 className="text-sm font-bold dark:text-white">Daily Executive Summary</h3>
          <p className="text-xs text-slate-500">{selectedStoreName} — {fromDate}</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/10 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Generating PDF..." : "Export Executive Summary PDF"}
        </button>
      </div>

      {stats && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
              <div className="flex justify-between items-start text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Net Sales</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-black mt-2 dark:text-white">{formatAED(stats.net)}</p>
              <p className="text-[9px] text-slate-500 mt-1">Gross: {formatAED(stats.gross)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
              <div className="flex justify-between items-start text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Guest Count</span>
                <Users className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-xl font-black mt-2 dark:text-white">{stats.guestCount}</p>
              <p className="text-[9px] text-slate-500 mt-1">Checks: {stats.checksCount}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
              <div className="flex justify-between items-start text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Average Ticket</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-black mt-2 dark:text-white">{formatAED(stats.avgCheck)}</p>
              <p className="text-[9px] text-slate-500 mt-1">Per Guest: {formatAED(stats.avgGuest)}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md">
              <div className="flex justify-between items-start text-slate-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Security Audits</span>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-black mt-2 dark:text-white">{formatAED(stats.discTotal)}</p>
              <p className="text-[9px] text-slate-500 mt-1">Voids: {stats.voidsCount} ({formatAED(stats.totalVoidsVal)})</p>
            </div>
          </div>

          {/* Operational Target Block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Daily Operations Target</h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">Target AED:</span>
                  <input
                    type="number"
                    value={operationalTarget || ""}
                    onChange={(e) => setOperationalTarget(Number(e.target.value))}
                    placeholder="Enter sales target..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-rose-600 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500">Performance Variance:</span>
                <span className={`text-xs font-black ${variance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {variance >= 0 ? "+" : ""}{formatAED(variance)} ({variancePct.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors lg:col-span-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Duty Assignment Logs</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Manager on Duty</label>
                  <input
                    value={modName}
                    onChange={(e) => setModName(e.target.value)}
                    className="w-full text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Kitchen Lead (BOH)</label>
                  <input
                    value={bohName}
                    onChange={(e) => setBohName(e.target.value)}
                    className="w-full text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Visualization Charts Block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Meal Period Revenue Split</h4>
              <div className="h-[240px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.segmentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.segmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} AED`} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Top 5 Departments Gross</h4>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => `${value} AED`} />
                    <Bar dataKey="value" fill="#e11d48" radius={[4, 4, 0, 0]}>
                      {stats.departmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lower Performers and Logs Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Top Performing Menu Items</h4>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-widest text-[9px]">
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-center">Qty Sold</th>
                      <th className="py-2 text-right">Gross Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                        <td className="py-2.5 text-center font-bold text-slate-600 dark:text-slate-400">{item.count}</td>
                        <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">{formatAED(item.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">DSR Financial Tally</h4>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400">Discounts Processed</span>
                  <span className="font-bold text-rose-500">-{formatAED(stats.discTotal)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400">Voids Registered</span>
                  <span className="font-bold text-rose-500">-{formatAED(stats.totalVoidsVal)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-slate-400">Tax Collected</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatAED(stats.tax)}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-slate-400">Tips Declared</span>
                  <span className="font-bold text-emerald-500">+{formatAED(stats.totalTips)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsModule;
