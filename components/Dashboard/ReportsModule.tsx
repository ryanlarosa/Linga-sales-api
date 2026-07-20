import React, { useState, useMemo, useRef } from "react";
import { FetchedData } from "../../types";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { 
  TrendingUp, Users, FileText, Gift, Trash2, Award, Calendar, Download, Landmark, FileCheck, ClipboardList, PenTool
} from 'lucide-react';

import { parseCurrency, formatAED } from "./Reports/ReportUtils";

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

const ReportsModule: React.FC<ReportsProps> = ({
  data,
  fromDate,
  selectedStoreName,
}) => {
  const [modName, setModName] = useState("RETCHEL");
  const [chefName, setChefName] = useState("JAMES KAKADU");
  const [reservations, setReservations] = useState(0);
  const [noShows, setNoShows] = useState(0);
  const [walkIns, setWalkIns] = useState(0);
  
  // Notes / Comments States
  const [specialEvents, setSpecialEvents] = useState("");
  const [vips, setVips] = useState("");
  const [complaints, setComplaints] = useState("");
  const [dayComments, setDayComments] = useState("");
  const [tomorrowBookings, setTomorrowBookings] = useState("");

  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // --- STATS DERIVATION ---
  const stats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;

    let grossSales = 0;
    let netSales = 0;
    let totalDiscount = 0;
    let totalCovers = 0;

    // Payment Type Map
    const payments: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      VISA: { amount: 0, count: 0 },
      "MASTER CARD": { amount: 0, count: 0 },
      AMEX: { amount: 0, count: 0 },
      CLUB: { amount: 0, count: 0 },
      DELIVEROO: { amount: 0, count: 0 },
      PEEKABOX: { amount: 0, count: 0 },
      COMPLIMENTARY: { amount: 0, count: 0 },
      "MARKETING COMPLIMENTARY": { amount: 0, count: 0 },
    };

    data.sales.forEach((s) => {
      grossSales += parseCurrency(s.grossReceiptStr);
      netSales += parseCurrency(s.netSalesStr);
      totalCovers += s.guestCount || 0;
    });

    data.saleDetails.forEach((d) => {
      if (d.check !== "Total") {
        totalDiscount += parseCurrency(d.discountAmtStr);
      }
    });

    // Populate Payment Tallies if available in backend payload
    if (data.paymentSummary) {
      data.paymentSummary.forEach((p) => {
        const type = p.name ? p.name.toUpperCase() : "";
        let matched = false;
        Object.keys(payments).forEach((key) => {
          if (type.includes(key)) {
            payments[key].amount += p.amount || 0;
            payments[key].count += p.count || 0;
            matched = true;
          }
        });
        if (!matched && p.amount > 0) {
          // Put in Cash/Card depending on name
          if (type.includes("CARD")) {
            payments["MASTER CARD"].amount += p.amount || 0;
          } else {
            payments["CASH"].amount += p.amount || 0;
          }
        }
      });
    }

    // Ensure total sum matches payments
    const totalPayments = Object.values(payments).reduce((acc, p) => acc + p.amount, 0);

    // Revenue breakdown by department
    const departments: Record<string, number> = {
      Food: 0,
      Beverage: 0,
      "Rise & Dawn": 0,
      "Encounter + Retail": 0,
    };

    data.detailedMenu.forEach((m) => {
      const val = parseCurrency(m.totalGrossAmountStr);
      const category = m.categoryName || "";
      const deptName = m.departmentName || "";
      
      if (deptName.toUpperCase().includes("FOOD") || category.toUpperCase().includes("FOOD")) {
        departments["Food"] += val;
      } else if (deptName.toUpperCase().includes("BEVERAGE") || category.toUpperCase().includes("BEVERAGE") || category.toUpperCase().includes("DRINK")) {
        departments["Beverage"] += val;
      } else if (deptName.toUpperCase().includes("RETAIL") || category.toUpperCase().includes("RETAIL")) {
        departments["Encounter + Retail"] += val;
      } else {
        departments["Encounter + Retail"] += val;
      }
    });

    // Top Selling Items list
    const itemsMap = new Map<string, { name: string; gross: number }>();
    data.detailedMenu.forEach((m) => {
      const curr = itemsMap.get(m.menuName) || { name: m.menuName, gross: 0 };
      curr.gross += parseCurrency(m.totalGrossAmountStr);
      itemsMap.set(m.menuName, curr);
    });
    const topItems = Array.from(itemsMap.values())
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 5);

    // Map saleId to ticketNo
    const saleIdToTicketNo = new Map<string, string>();
    data.sales.forEach((s) => {
      saleIdToTicketNo.set(s.id, s.ticketNo);
    });

    // Group voids and comps by ticketNo
    const checkVoids = new Map<string, number>();
    const checkComps = new Map<string, number>();

    data.detailedMenu.forEach((m) => {
      const ticketNo = saleIdToTicketNo.get(m.saleId);
      if (!ticketNo) return;
      
      const isVoid = m.isVoid === "Y" || m.isVoid === "true";
      const val = parseCurrency(m.totalGrossAmountStr);
      
      if (isVoid) {
        checkVoids.set(ticketNo, (checkVoids.get(ticketNo) || 0) + val);
      }
      
      const discVal = m.totalDiscountAmountStr ? parseCurrency(m.totalDiscountAmountStr) : 0;
      if (discVal > 0 && Math.abs(discVal - val) < 0.05) {
        checkComps.set(ticketNo, (checkComps.get(ticketNo) || 0) + discVal);
      }
    });

    // Discount ledger items
    const discountLedger = data.saleDetails
      .filter((d) => d.check !== "Total")
      .map((d) => {
        const checkNo = d.check || "N/A";
        const voidAmt = checkVoids.get(checkNo) || 0;
        const compAmt = checkComps.get(checkNo) || 0;
        const discountAmt = parseCurrency(d.discountAmtStr);
        return {
          checkNo,
          voidAmt,
          compAmt,
          discountAmt: compAmt > 0 ? 0 : discountAmt, // Avoid double counting
          remarks: d.discountName || "General Discount"
        };
      });

    return {
      grossSales,
      netSales,
      totalDiscount,
      totalCovers,
      averageCheck: totalCovers > 0 ? netSales / totalCovers : 0,
      departments,
      payments,
      totalPayments,
      topItems,
      discountLedger
    };
  }, [data]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: isDark ? "#020617" : "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`DSR_Report_${selectedStoreName}_${fromDate}.pdf`);
    } catch (err) {
      console.error("PDF Export Failed:", err);
    } finally {
      setExporting(false);
    }
  };

  if (!data || !stats) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 py-20">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
        <p className="italic font-medium">Synchronizing Cloud Data...</p>
      </div>
    );
  }

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn pb-12">
      {/* Upper Control Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h3 className="text-sm font-bold dark:text-white">Daily Operations Recap & DSR</h3>
          <p className="text-xs text-slate-500">{selectedStoreName} — {fromDate}</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/10 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Generating PDF..." : "Export EOD PDF Report"}
        </button>
      </div>

      <div ref={reportRef} className="space-y-6 bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Main Header */}
        <div className="bg-[#001f3f] dark:bg-slate-900 text-white py-4 px-6 rounded-2xl flex justify-between items-center">
          <h2 className="text-base font-black tracking-widest uppercase">{selectedStoreName}</h2>
          <span className="text-xs font-bold tracking-widest uppercase">{fromDate}</span>
        </div>

        {/* Executive DSR Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: DSR Core Metrics */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Metric Summary</h4>
              <ClipboardList className="w-4 h-4 text-rose-500" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">MOD Name / Chef</span>
                <div className="flex gap-2 mt-1">
                  <input 
                    value={modName} 
                    onChange={(e) => setModName(e.target.value)}
                    className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                  />
                  <input 
                    value={chefName} 
                    onChange={(e) => setChefName(e.target.value)}
                    className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Total Covers</span>
                <p className="text-sm font-black mt-1 dark:text-white">{stats.totalCovers}</p>
              </div>
              
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Reservations</span>
                <input 
                  type="number" 
                  value={reservations} 
                  onChange={(e) => setReservations(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-lg text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Walk-Ins</span>
                <input 
                  type="number" 
                  value={walkIns} 
                  onChange={(e) => setWalkIns(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-lg text-xs font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Grand Sales:</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(stats.grossSales)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">NET Daily Revenue:</span>
                  <span className="font-black text-emerald-500">{formatAED(stats.netSales)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Average Check per Guest:</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(stats.averageCheck)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column: Department Revenue Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Revenue mix</h4>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="space-y-2.5 text-xs">
              {Object.entries(stats.departments).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0">
                  <span className="text-slate-400">{name}</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <span className="text-slate-400">Discounted Deductions:</span>
                <span className="font-bold text-rose-500">-{formatAED(stats.totalDiscount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Revenue:</span>
                <span className="text-sm font-black text-emerald-500">{formatAED(stats.netSales)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Settlement Split */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Payment Tally</h4>
              <Landmark className="w-4 h-4 text-blue-500" />
            </div>

            <div className="space-y-2 text-xs overflow-y-auto max-h-[200px] custom-scrollbar">
              {Object.entries(stats.payments).map(([name, val]) => (
                <div key={name} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1 last:border-0">
                  <span className="text-slate-400 text-[10px]">{name}</span>
                  <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(val.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Payments:</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(stats.totalPayments || stats.grossSales)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Notes, Top Selling, and Large Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes & Special Events Comments */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 lg:col-span-2">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Operations & Duty Notes</h4>
              <PenTool className="w-4 h-4 text-amber-500" />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Special Events / VIPs</label>
                <textarea
                  value={specialEvents}
                  onChange={(e) => setSpecialEvents(e.target.value)}
                  placeholder="Enter events or VIP notes..."
                  className="w-full text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-16 resize-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Guest Complaints & Recovery</label>
                <textarea
                  value={complaints}
                  onChange={(e) => setComplaints(e.target.value)}
                  placeholder="Enter guest feedback and recovery solutions..."
                  className="w-full text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-16 resize-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Overall Day Comments</label>
                <textarea
                  value={dayComments}
                  onChange={(e) => setDayComments(e.target.value)}
                  placeholder="Summarize the shift flow (e.g. Target progress, flow of guests, etc.)..."
                  className="w-full text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-20 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right section: Top Selling List and Tomorrow's bookings */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Top Selling Items</h4>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-2 text-xs">
                {stats.topItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-1.5 last:border-0">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.name}</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatAED(item.gross)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tomorrow's Bookings</h4>
                <Calendar className="w-4 h-4 text-rose-500" />
              </div>
              <input
                value={tomorrowBookings}
                onChange={(e) => setTomorrowBookings(e.target.value)}
                placeholder="Tomorrow's bookings..."
                className="w-full text-xs font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Lower Section: Discount Ledger Audit */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Discount Audit Page</h4>
            <FileCheck className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-widest text-[9px]">
                  <th className="py-2.5 px-3">Receipt Check No.</th>
                  <th className="py-2.5 px-3 text-center">Void</th>
                  <th className="py-2.5 px-3 text-center">Comp</th>
                  <th className="py-2.5 px-3 text-center">Discount</th>
                  <th className="py-2.5 px-3">Remarks / Reason</th>
                </tr>
              </thead>
              <tbody>
                {stats.discountLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">No discounts or voids processed today.</td>
                  </tr>
                ) : (
                  stats.discountLedger.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">{row.checkNo}</td>
                      <td className="py-2 px-3 text-center text-rose-500 font-semibold">{row.voidAmt > 0 ? formatAED(row.voidAmt) : "-"}</td>
                      <td className="py-2 px-3 text-center text-rose-500 font-semibold">{row.compAmt > 0 ? formatAED(row.compAmt) : "-"}</td>
                      <td className="py-2 px-3 text-center text-rose-600 font-black">{row.discountAmt > 0 ? formatAED(row.discountAmt) : "-"}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-medium">{row.remarks}</td>
                    </tr>
                  ))
                )}
                {stats.discountLedger.length > 0 && (
                  <tr className="bg-slate-50 dark:bg-slate-950 font-black">
                    <td className="py-3 px-3 uppercase text-[10px] text-slate-900 dark:text-white">Total</td>
                    <td className="py-3 px-3 text-center text-rose-500">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.voidAmt, 0))}
                    </td>
                    <td className="py-3 px-3 text-center text-rose-500">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.compAmt, 0))}
                    </td>
                    <td className="py-3 px-3 text-center text-rose-600">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.discountAmt, 0))}
                    </td>
                    <td className="py-3 px-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
