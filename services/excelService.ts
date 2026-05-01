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

  // Create a map of sales by composite key: ticketNo + startDate (date only, not time)
  // This ensures unique matching even when ticket numbers repeat across different dates
  const salesByTicketAndDate = new Map<string, (typeof data.sales)[0]>();
  data.sales.forEach((sale) => {
    if (sale.ticketNo && sale.startDate) {
      // Extract just the date part from startDate (e.g., "2024-01-15T00:00:00.000Z" -> "2024-01-15")
      const saleDatePart = sale.startDate.split("T")[0];
      const compositeKey = `${sale.ticketNo}_${saleDatePart}`;
      salesByTicketAndDate.set(compositeKey, sale);
    }
  });

  // SHEET 2: DiscountData
  const filteredDiscountData = data.saleDetails.filter(
    (item) => item.check !== "Total",
  );
  const discountData = filteredDiscountData.map((item) => {
    // Try to match by composite key first (ticketNo + date), then fall back to ticketNo only
    let saleOpenTime = "Unknown";
    let saleDate = "Unknown";

    // First attempt: match by ticketNo + date from the discount's date field
    if (item.date) {
      const discountDatePart = item.date.split("T")[0];
      const compositeKey = `${item.check}_${discountDatePart}`;
      const matchedSale = salesByTicketAndDate.get(compositeKey);
      if (matchedSale) {
        saleOpenTime = matchedSale.saleOpenTime;
        saleDate = matchedSale.startDate;
      }
    }

    // Fallback: if no match by composite key, try matching by ticketNo only
    // This handles cases where discount date might not be properly set
    if (saleOpenTime === "Unknown") {
      const fallbackSale = data.sales.find((s) => s.ticketNo === item.check);
      if (fallbackSale) {
        saleOpenTime = fallbackSale.saleOpenTime;
        saleDate = fallbackSale.startDate;
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
