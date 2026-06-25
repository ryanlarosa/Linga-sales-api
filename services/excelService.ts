import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { FetchedData } from "../types";

const parseNum = (val: string | number | undefined | null): number => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const strVal = String(val).replace(/[$,\s]/g, "");
  const num = parseFloat(strVal);
  return isNaN(num) ? 0 : num;
};

export const exportToExcel = (data: FetchedData, storeName: string) => {
  if (!data || !data.sales || data.sales.length === 0) {
    throw new Error("No Data to Export");
  }

  const selectedStoreName = storeName || "Unknown Store";

  // SHEET 1: SalesData
  const salesData = data.sales.map((item) => {
    const saleDate = new Date(item.startDate);
    const day = String(saleDate.getDate()).padStart(2, "0");
    const month = String(saleDate.getMonth() + 1).padStart(2, "0");
    const year = saleDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    //const floorName =
    //  data.floors.find((f) => f.id === item.floorId)?.floorName || "Unknown";
    const createdBy =
      data.users.find((u) => u.id === item.employee)?.name || "Unknown";
    const closedBy =
      data.users.find((u) => u.id === item.saleCloseEmployee)?.name ||
      "Unknown";

    const floorNo =
      data.saleSummary.find((s) => s.id === item.id)?.floorNo || "Unknown";

    const tableNo =
      data.saleSummary.find((s) => s.id === item.id)?.tableNo || "Unknown";

    const summary = data.saleSummary.find((s) => s.id === item.id);

    return {
      Store: selectedStoreName,
      Ticket_No: item.ticketNo,
      Customer_Name: item.customerName,
      Sale_Open_Time: item.saleOpenTime,
      //Floor: floorName,
      Floor: floorNo,
      Table_No: tableNo,
      Net_Sales: parseNum(summary?.netSales),
      Total_Tax: parseNum(summary?.totalTaxAmount),
      Discount: parseNum(summary?.discounts),
      Gross_Receipt: parseNum(item.grossReceiptStr),
      Closed_By: closedBy,
      Server_Name: createdBy,
      Guest_Count: item.guestCount,
      Final_SaleDate: formattedDate,
    };
  });

  // Create a map of sales by composite key: ticketNo + startDate + saleOpenTime (hour:minute)
  // This ensures unique matching even when ticket numbers repeat across different dates/times
  const salesByTicketDateTime = new Map<string, (typeof data.sales)[0]>();
  data.sales.forEach((sale) => {
    if (sale.ticketNo && sale.startDate && sale.saleOpenTime) {
      // Extract date part and normalize time (take first 5 chars: "HH:mm")
      const saleDatePart = sale.startDate.split("T")[0];
      const saleTimePart = sale.saleOpenTime.substring(0, 5); // "HH:mm" format
      const compositeKey = `${sale.ticketNo}_${saleDatePart}_${saleTimePart}`;
      salesByTicketDateTime.set(compositeKey, sale);
    }
  });

  // Also create a map by ticketNo + date only (for fallback when time not available)
  const salesByTicketAndDate = new Map<string, (typeof data.sales)[0]>();
  data.sales.forEach((sale) => {
    if (sale.ticketNo && sale.startDate) {
      const saleDatePart = sale.startDate.split("T")[0];
      const compositeKey = `${sale.ticketNo}_${saleDatePart}`;
      salesByTicketAndDate.set(compositeKey, sale);
    }
  });

  // SHEET 2: DiscountData
  const filteredDiscountData = data.saleDetails.filter(
    (item) => item.check !== "Total",
  );

  // Helper function to parse discount date format (e.g., "28-Apr-2026")
  const parseDiscountDate = (dateStr: string): string => {
    if (!dateStr) return "";
    // Handle format like "28-Apr-2026"
    const months: Record<string, string> = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parts[0].trim();
      const month = months[parts[1].trim()] || "01";
      const year = parts[2].trim();
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
    return dateStr;
  };

  const discountData = filteredDiscountData.map((item) => {
    let saleOpenTime = "Unknown";
    let saleDate = "Unknown";

    if (item.check && item.date) {
      // Parse discount date to ISO format (YYYY-MM-DD)
      const discountDatePart = parseDiscountDate(item.date);
      const discountGrossSales = parseNum(item.grossSalesStr);

      // Get all sales with matching ticket number and date first to avoid matching wrong dates on reused tickets
      let potentialMatches = data.sales.filter((s) => {
        if (s.ticketNo !== item.check) return false;
        if (!s.startDate) return true; // Fallback if no date on sale
        const saleDatePart = s.startDate.split("T")[0];
        return saleDatePart === discountDatePart;
      });

      // Fallback: match by ticket number only if no exact date match
      if (potentialMatches.length === 0) {
        potentialMatches = data.sales.filter(
          (s) => s.ticketNo === item.check,
        );
      }

      if (potentialMatches.length > 0) {
        let matchedSale = potentialMatches[0];

        // If there's more than one potential sale match, match by amount
        if (potentialMatches.length > 1) {
          // Try to find a sale where grossReceiptStr matches grossSalesStr (within tolerance)
          matchedSale =
            potentialMatches.find((s) => {
              const saleGrossReceipt = parseNum(s.grossReceiptStr);
              if (saleGrossReceipt === discountGrossSales) return true;
              // Check if the amounts are close (within 2% tolerance)
              const divisor = saleGrossReceipt === 0 ? 1 : saleGrossReceipt;
              return (
                Math.abs(saleGrossReceipt - discountGrossSales) <
                divisor * 0.02
              );
            }) || potentialMatches[0];
        }

        saleOpenTime = matchedSale.saleOpenTime;
        saleDate = matchedSale.startDate;
      }
    }

    const saleDateObj = new Date(saleDate);
    const day = String(saleDateObj.getDate()).padStart(2, "0");
    const month = String(saleDateObj.getMonth() + 1).padStart(2, "0");
    const year = saleDateObj.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    return {
      Store: selectedStoreName,
      Approved_By: item.approvedBy,
      Check: item.check, // Mapped to Link to Ticket
      //Date: item.date,
      SaleDate: formattedDate,
      Sale_Open_Time: saleOpenTime,
      Discount_Amount: parseNum(item.discountAmtStr),
      Discount_Applied_By: item.discountAppliedBy,
      Discount_Coupon: item.discountCoupon,
      Discount_Name: item.discountName,
      Discount_Type: item.discountType,
      Gross_Sales: parseNum(item.grossSalesStr),
      Is_Total: item.isTotal,
      Menu_Items: item.menuItems,
      Percent: item.percent,
      Quantity: item.quantity,
      Reason: item.reason,
      Total_Discounts: parseNum(item.totalDiscounts),
    };
  });

  // Also create a map for saleDetails by composite key for MenuItem matching
  const saleDetailsByTicketAndDate = new Map<
    string,
    (typeof data.saleDetails)[0]
  >();
  data.saleDetails.forEach((detail) => {
    if (detail.check && detail.date) {
      const detailDatePart = detail.date.split("T")[0];
      const compositeKey = `${detail.check}_${detailDatePart}`;
      saleDetailsByTicketAndDate.set(compositeKey, detail);
    }
  });

  // SHEET 3: MenuItemDetailed
  const menuItemData = data.detailedMenu.map((item) => {
    const saleDate = new Date(item.saleDate);
    const day = String(saleDate.getDate()).padStart(2, "0");
    const month = String(saleDate.getMonth() + 1).padStart(2, "0");
    const year = saleDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;
    const orderMin = String(item.orderMin).padStart(2, "0");

    const voidBy =
      data.users.find((u) => u.id === item.voidByEmployee)?.name || "Unknown";

    // Match discount by composite key (ticketNo + date) for accuracy
    let discountName = "N/A";
    if (item.saleId && item.saleDate) {
      const menuItemDatePart = item.saleDate.split("T")[0];
      const compositeKey = `${item.saleId}_${menuItemDatePart}`;
      const matchedDetail = saleDetailsByTicketAndDate.get(compositeKey);
      if (
        matchedDetail &&
        matchedDetail.discountName &&
        item.totalDiscountAmountStr !== "0.00"
      ) {
        discountName = matchedDetail.discountName;
      }
    }

    return {
      Store: selectedStoreName,
      Order_Date: formattedDate,
      Order_Hour: `${item.orderHour}:${orderMin}`,
      Ticket_No: item.saleId,
      Department: item.departmentName,
      CategoryName: item.categoryName,
      SubCategoryName: item.subCategoryName,
      Quantity: item.quantity,
      Menu_Item: item.menuName,
      Gross_Amount: parseNum(item.grossAmountStr),
      Total_Amount: parseNum(item.totalGrossAmountStr),
      Discount: parseNum(item.totalDiscountAmountStr),
      DiscountName: discountName,
      Is_Void: item.isVoid,
      Void_Reason: item.voidError,
      VoidedBy: voidBy,
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(salesData),
    "SalesData",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(discountData),
    "DiscountData",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(menuItemData),
    "MenuItemDetailed",
  );

  XLSX.writeFile(workbook, `Linga_Analytics_${selectedStoreName}.xlsx`);
};

export const exportAnalysisToExcel = (
  analysisData: any[],
  dimension: string,
  storeName: string,
) => {
  const data = analysisData.map((item) => ({
    [dimension]: item.name,
    Quantity: item.count,
    Value: parseNum(item.value),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, dimension);
  XLSX.writeFile(wb, `${dimension}_Report_${storeName}.xlsx`);
};

export const exportTrendToExcel = async (trendData: any[], totals: any, anchorDate: string, anchorDates: Date[]) => {
  if (!trendData || trendData.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Covers Analysis');

  // Ensure grid lines are visible in the spreadsheet
  worksheet.views = [{ showGridLines: true }];

  // Set column widths
  worksheet.columns = [
    { header: 'Venue Name', key: 'venue', width: 32 },
    { header: 'Selected Day', key: 'thisWk', width: 16 },
    { header: 'Last Week', key: 'lastWk', width: 16 },
    { header: 'Last Month', key: 'lastMth', width: 16 },
    { header: 'Last Year', key: 'lastYr', width: 16 },
    { header: 'Var LW', key: 'varLw', width: 14 },
    { header: 'Var LM', key: 'varLm', width: 14 },
    { header: 'Var LY', key: 'varLy', width: 14 },
  ];

  const formatDate = (d: Date) => {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;
  };

  // Add titles
  worksheet.addRow([]);
  const titleRow = worksheet.addRow(['Daily Covers Tracker']);
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  
  const dateRow = worksheet.addRow([`Report Date: ${anchorDate}`]);
  dateRow.getCell(1).font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF475569' } };
  worksheet.addRow([]); // Blank spacer

  // Table Headers
  const headerRow1 = worksheet.addRow([
    'Venue Name',
    'Selected Day',
    'Last Week',
    'Last Month',
    'Last Year',
    'Var LW',
    'Var LM',
    'Var LY'
  ]);
  const headerRow2 = worksheet.addRow([
    '',
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '',
    '',
    ''
  ]);

  // Merge headers vertically
  worksheet.mergeCells('A5:A6');
  worksheet.mergeCells('F5:F6');
  worksheet.mergeCells('G5:G6');
  worksheet.mergeCells('H5:H6');

  // Center vertical headers and apply styling
  const headerCells = [
    'A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5',
    'B6', 'C6', 'D6', 'E6'
  ];

  headerCells.forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate-800
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 20;

  // Add Totals (Company level) first, styled beautifully
  const totalRow = worksheet.addRow([
    'Company Total',
    totals.thisWk,
    totals.lastWk,
    totals.lastMth,
    totals.lastYr,
    totals.thisWk - totals.lastWk,
    totals.thisWk - totals.lastMth,
    totals.thisWk - totals.lastYr
  ]);

  // Styles for totals row cells
  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Slate-100
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Double bottom line for totals
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (col <= 5) {
        cell.numFmt = '#,##0';
      }
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  // Color code Company Total variance cells
  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value as number;
    cell.numFmt = '+#,##0;-#,##0;0';
    if (val > 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else if (val < 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
    }
  }

  // Add Venue rows
  trendData.forEach((row) => {
    const rowData = [
      row.storeName,
      row.thisWk,
      row.lastWk,
      row.lastMth,
      row.lastYr,
      row.thisWk - row.lastWk,
      row.thisWk - row.lastMth,
      row.thisWk - row.lastYr
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 20;

    for (let col = 1; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (col > 1) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (col <= 5) {
          cell.numFmt = '#,##0';
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    // Color code individual venue variance cells
    for (let col = 6; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      const val = cell.value as number;
      cell.numFmt = '+#,##0;-#,##0;0';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  });

  // Add second sheet for raw sales data
  const dataSheet = workbook.addWorksheet('SalesData');
  dataSheet.views = [{ showGridLines: true }];

  dataSheet.columns = [
    { header: 'Store', key: 'store', width: 25 },
    { header: 'Ticket No', key: 'ticket', width: 14 },
    { header: 'Customer Name', key: 'customer', width: 20 },
    { header: 'Open Time', key: 'openTime', width: 22 },
    { header: 'Floor', key: 'floor', width: 12 },
    { header: 'Table', key: 'table', width: 10 },
    { header: 'Net Sales', key: 'netSales', width: 14 },
    { header: 'Total Tax', key: 'tax', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Gross Receipt', key: 'gross', width: 14 },
    { header: 'Guest Count', key: 'guests', width: 12 },
    { header: 'Date', key: 'date', width: 14 }
  ];

  const dataHeaderCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
  dataHeaderCells.forEach(cellRef => {
    const cell = dataSheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  trendData.forEach(storeRow => {
    const rawSales = storeRow.salesData || [];
    rawSales.forEach((sale: any) => {
      const saleRow = dataSheet.addRow([
        storeRow.storeName,
        sale.ticketNo,
        sale.customerName || 'Walk-in Guest',
        sale.saleOpenTime,
        sale.floorNo,
        sale.tableNo,
        sale.netSalesVal,
        sale.taxVal,
        sale.discountVal,
        parseNum(sale.grossReceiptStr),
        sale.guestCount,
        anchorDate
      ]);

      for (let col = 7; col <= 10; col++) {
        const cell = saleRow.getCell(col);
        cell.numFmt = '"AED" #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      saleRow.getCell(11).numFmt = '#,##0';
      saleRow.getCell(11).alignment = { horizontal: 'right' };
    });
  });

  // Write and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Consolidated_Cover_Report_${anchorDate}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const exportSalesTrendToExcel = async (
  trendData: any[],
  totals: any,
  anchorDate: string,
  anchorDates: Date[],
  discountsData: any[] = []
) => {
  if (!trendData || trendData.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales Analysis');

  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { header: 'Venue Name', key: 'venue', width: 32 },
    { header: 'Selected Day', key: 'thisWk', width: 18 },
    { header: 'Last Week', key: 'lastWk', width: 18 },
    { header: 'Last Month', key: 'lastMth', width: 18 },
    { header: 'Last Year', key: 'lastYr', width: 18 },
    { header: 'Var LW', key: 'varLw', width: 16 },
    { header: 'Var LM', key: 'varLm', width: 16 },
    { header: 'Var LY', key: 'varLy', width: 16 },
  ];

  const formatDate = (d: Date) => {
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)}`;
  };

  worksheet.addRow([]);
  const titleRow = worksheet.addRow(['Daily Sales Tracker']);
  titleRow.getCell(1).font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  
  const dateRow = worksheet.addRow([`Report Date: ${anchorDate}`]);
  dateRow.getCell(1).font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF475569' } };
  worksheet.addRow([]);

  const headerRow1 = worksheet.addRow([
    'Venue Name',
    'Selected Day',
    'Last Week',
    'Last Month',
    'Last Year',
    'Var LW',
    'Var LM',
    'Var LY'
  ]);
  const headerRow2 = worksheet.addRow([
    '',
    formatDate(anchorDates[0]),
    formatDate(anchorDates[1]),
    formatDate(anchorDates[2]),
    formatDate(anchorDates[3]),
    '',
    '',
    ''
  ]);

  worksheet.mergeCells('A5:A6');
  worksheet.mergeCells('F5:F6');
  worksheet.mergeCells('G5:G6');
  worksheet.mergeCells('H5:H6');

  const headerCells = [
    'A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5',
    'B6', 'C6', 'D6', 'E6'
  ];

  headerCells.forEach(cellRef => {
    const cell = worksheet.getCell(cellRef);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'thin', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 20;

  const totalRow = worksheet.addRow([
    'Company Total',
    totals.thisWk,
    totals.lastWk,
    totals.lastMth,
    totals.lastYr,
    totals.thisWk - totals.lastWk,
    totals.thisWk - totals.lastMth,
    totals.thisWk - totals.lastYr
  ]);

  for (let col = 1; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    if (col > 1) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '"AED" #,##0.00';
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  for (let col = 6; col <= 8; col++) {
    const cell = totalRow.getCell(col);
    const val = cell.value as number;
    cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
    if (val > 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else if (val < 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
    }
  }

  trendData.forEach((row) => {
    const rowData = [
      row.storeName,
      row.thisWk,
      row.lastWk,
      row.lastMth,
      row.lastYr,
      row.thisWk - row.lastWk,
      row.thisWk - row.lastMth,
      row.thisWk - row.lastYr
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 20;

    for (let col = 1; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (col > 1) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '"AED" #,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    for (let col = 6; col <= 8; col++) {
      const cell = dataRow.getCell(col);
      const val = cell.value as number;
      cell.numFmt = '+"AED" #,##0.00;-"AED" #,##0.00;"AED" 0.00';
      if (val > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
      } else if (val < 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      }
    }
  });

  // Add second sheet for raw sales data
  const dataSheet = workbook.addWorksheet('SalesData');
  dataSheet.views = [{ showGridLines: true }];

  dataSheet.columns = [
    { header: 'Store', key: 'store', width: 25 },
    { header: 'Ticket No', key: 'ticket', width: 14 },
    { header: 'Customer Name', key: 'customer', width: 20 },
    { header: 'Open Time', key: 'openTime', width: 22 },
    { header: 'Floor', key: 'floor', width: 12 },
    { header: 'Table', key: 'table', width: 10 },
    { header: 'Net Sales', key: 'netSales', width: 14 },
    { header: 'Total Tax', key: 'tax', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Gross Receipt', key: 'gross', width: 14 },
    { header: 'Guest Count', key: 'guests', width: 12 },
    { header: 'Date', key: 'date', width: 14 }
  ];

  const dataHeaderCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
  dataHeaderCells.forEach(cellRef => {
    const cell = dataSheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  trendData.forEach(storeRow => {
    const rawSales = storeRow.salesData || [];
    rawSales.forEach((sale: any) => {
      const saleRow = dataSheet.addRow([
        storeRow.storeName,
        sale.ticketNo,
        sale.customerName || 'Walk-in Guest',
        sale.saleOpenTime,
        sale.floorNo,
        sale.tableNo,
        sale.netSalesVal,
        sale.taxVal,
        sale.discountVal,
        parseNum(sale.grossReceiptStr),
        sale.guestCount,
        anchorDate
      ]);

      for (let col = 7; col <= 10; col++) {
        const cell = saleRow.getCell(col);
        cell.numFmt = '"AED" #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      saleRow.getCell(11).numFmt = '#,##0';
      saleRow.getCell(11).alignment = { horizontal: 'right' };
    });
  });

  // Add third sheet for Discount Summary
  const discountSheet = workbook.addWorksheet('Discount Summary');
  discountSheet.views = [{ showGridLines: true }];

  discountSheet.columns = [
    { header: 'Store', key: 'store', width: 25 },
    { header: 'Approved By', key: 'approvedBy', width: 18 },
    { header: 'Check/Ticket No', key: 'check', width: 14 },
    { header: 'SaleDate', key: 'saleDate', width: 14 },
    { header: 'Sale_Open_Time', key: 'saleOpenTime', width: 16 },
    { header: 'Discount Amount', key: 'discountAmt', width: 16 },
    { header: 'Applied By', key: 'appliedBy', width: 18 },
    { header: 'Discount Coupon', key: 'coupon', width: 18 },
    { header: 'Discount Name', key: 'name', width: 20 },
    { header: 'Discount Type', key: 'type', width: 16 },
    { header: 'Gross Sales', key: 'grossSales', width: 14 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Reason', key: 'reason', width: 25 }
  ];

  const discountHeaderCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'M1'];
  discountHeaderCells.forEach(cellRef => {
    const cell = discountSheet.getCell(cellRef);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  discountsData.forEach(item => {
    // Lookup matching sale from trendData's sales list to get exact sale open time
    let saleOpenTime = 'Unknown';
    const storeRow = trendData.find(r => r.storeName === item.storeName);
    if (storeRow && storeRow.salesData) {
      // Since all consolidated sales are on the selected day, we match by check No
      const matchedSales = storeRow.salesData.filter((s: any) => s.ticketNo === item.check);
      if (matchedSales.length > 0) {
        let matched = matchedSales[0];
        if (matchedSales.length > 1) {
          const discountAmt = parseNum(item.discountAmtStr);
          matched = matchedSales.find((s: any) => parseNum(s.discountVal) === discountAmt) || matchedSales[0];
        }
        saleOpenTime = matched.saleOpenTime || 'Unknown';
      }
    }

    const rawDate = new Date(anchorDate);
    const day = String(rawDate.getDate()).padStart(2, "0");
    const month = String(rawDate.getMonth() + 1).padStart(2, "0");
    const year = rawDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const row = discountSheet.addRow([
      item.storeName,
      item.approvedBy,
      item.check,
      formattedDate,
      saleOpenTime,
      parseNum(item.discountAmtStr),
      item.discountAppliedBy,
      item.discountCoupon,
      item.discountName,
      item.discountType,
      parseNum(item.grossSalesStr),
      item.quantity,
      item.reason
    ]);

    row.getCell(6).numFmt = '"AED" #,##0.00';
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(11).numFmt = '"AED" #,##0.00';
    row.getCell(11).alignment = { horizontal: 'right' };
    row.getCell(12).numFmt = '#,##0';
    row.getCell(12).alignment = { horizontal: 'right' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Consolidated_Sales_Report_${anchorDate}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

