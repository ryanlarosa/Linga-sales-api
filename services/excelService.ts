import * as XLSX from "xlsx";
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
      const discountAmount = parseNum(item.discountAmtStr);

      // First try: match by ticketNo + parsed discount date
      let potentialMatches = data.sales.filter(
        (s) =>
          s.ticketNo === item.check &&
          s.startDate?.split("T")[0] === discountDatePart,
      );

      // If no match by discount date, try to match by ticketNo only
      if (potentialMatches.length === 0) {
        potentialMatches = data.sales.filter((s) => s.ticketNo === item.check);
      }

      if (potentialMatches.length > 0) {
        // If there's only one match, use it
        // If there are multiple matches, try to find the one with matching discount amount
        let matchedSale = potentialMatches[0];

        if (potentialMatches.length > 1 && discountAmount > 0) {
          // Try to find a sale that has a discount amount matching the discount data
          // by comparing grossSalesStr from discount with grossAmountStr from sale
          const discountGrossSales = parseNum(item.grossSalesStr);
          matchedSale =
            potentialMatches.find((s) => {
              const saleGross = parseNum(s.grossReceiptStr);
              // Check if the gross amounts are close (within 1% tolerance)
              return (
                Math.abs(saleGross - discountGrossSales) < saleGross * 0.01
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
