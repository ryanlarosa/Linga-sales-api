import { USE_MOCK_DATA } from "../constants";
import {
  FetchedData,
  SaleOrder,
  Floor,
  StoreUser,
  MenuItemDetail,
  SaleSummary,
  DiscountDetail,
  PaymentSummaryItem,
} from "../types";

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

const parseApiFloat = (val: string | null | undefined): number => {
  if (!val) return 0;
  const clean = String(val).replace(/,/g, "");
  return parseFloat(clean) || 0;
};

const getMockData = (storeId: string): FetchedData => {
  const mockSales: SaleOrder[] = Array.from({ length: 120 }, (_, i) => {
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const saleDate = new Date();
    saleDate.setHours(hour, minute, 0, 0);
    return {
      id: `sale_${i}`,
      ticketNo: `TKT-100${i}`,
      startDate: saleDate.toISOString(),
      saleOpenTime: saleDate.toISOString(),
      customerName: "Walk-in Guest",
      tableNo: String((i % 20) + 1),
      floorId: "floor_1",
      employee: "emp_1",
      saleCloseEmployee: "emp_1",
      guestCount: Math.floor(Math.random() * 4) + 1,
      netSalesStr: (Math.random() * 100 + 150).toFixed(2),
      grossAmountStr: (Math.random() * 120 + 170).toFixed(2),
      totalTaxAmountStr: "15.00",
      grossReceiptStr: (Math.random() * 120 + 170).toFixed(2),
      payments: [
        {
          paymentMethod: i % 2 === 0 ? "Visa Card" : "Cash",
          paymentType: i % 2 === 0 ? "Side CC" : "Cash",
          authorizedAmountStr: "200.00",
          paymentTipStr: "10.00",
        },
      ],
    };
  });

  return {
    sales: mockSales,
    saleDetails: [],
    floors: [{ id: "floor_1", floorName: "Main Dining" }],
    users: [{ id: "emp_1", name: "Ahmed Manager" }],
    menus: [],
    detailedMenu: [],
    saleSummary: mockSales.map((s) => ({
      id: s.id,
      netSales: s.netSalesStr,
      totalTaxAmount: s.totalTaxAmountStr,
      discounts: "0.00",
    })),
    totalGrossAmount: "63,913.00",
    paymentSummary: [
      { name: "Cash", type: "Cash", amount: 15420.5, tips: 0, count: 12 },
      {
        name: "Visa Card",
        type: "Side CC",
        amount: 5961.05,
        tips: 425.33,
        count: 91,
      },
      {
        name: "Master Card",
        type: "Side CC",
        amount: 3865.25,
        tips: 301.32,
        count: 44,
      },
      {
        name: "Deliveroo Card",
        type: "Other",
        amount: 3181.0,
        tips: 0,
        count: 25,
      },
    ],
    isSimulated: true,
  };
};

async function fetchFromBackend(endpoint: string): Promise<any> {
  try {
    const response = await fetch(`/api${endpoint}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 504 || response.status === 502) {
        throw new Error(
          "Cloud Gateway Timeout: Data is too large for a single pass. We are retrying with smaller fragments."
        );
      }
      const errorBody = await response.text();
      let errorMessage = `Server Error (${response.status})`;
      try {
        const json = JSON.parse(errorBody);
        errorMessage = json.message || json.error || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error: any) {
    throw error;
  }
}

/**
 * Fetches data in small date chunks to avoid 504 Timeouts.
 * Strictly de-duplicates records to ensure accurate totals.
 */
export const fetchDashboardData = async (
  storeId: string,
  from: Date,
  to: Date,
  forceMock: boolean = false,
  onProgress?: (msg: string) => void
): Promise<FetchedData> => {
  if (USE_MOCK_DATA || forceMock) {
    onProgress?.("Simulating connection...");
    await new Promise((resolve) => setTimeout(resolve, 800));
    return getMockData(storeId);
  }

  // Define chunk size (strictly 7 day periods)
  const chunks: { from: Date; to: Date }[] = [];
  let currentStart = new Date(from);
  currentStart.setHours(0, 0, 0, 0);

  const finalTo = new Date(to);
  finalTo.setHours(23, 59, 59, 999);

  while (currentStart <= finalTo) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6); // 7-day window
    if (currentEnd > finalTo) currentEnd = new Date(finalTo);

    chunks.push({ from: new Date(currentStart), to: new Date(currentEnd) });

    // Move to next day
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  // Tracking for strict de-duplication
  const seenSaleIds = new Set<string>();
  const seenDiscountIds = new Set<string>();
  const seenMenuItemReportIds = new Set<string>();
  const paymentMap = new Map<
    string,
    { amount: number; tips: number; count: number; type: string }
  >();

  const aggregate: FetchedData = {
    sales: [],
    saleDetails: [],
    floors: [],
    users: [],
    menus: [],
    detailedMenu: [],
    saleSummary: [],
    totalGrossAmount: "0.00",
    paymentSummary: [],
    isSimulated: false,
  };

  let runningGross = 0;

  // 1. Fetch metadata once
  onProgress?.("Fetching Store Config...");
  try {
    const [floorData, userData] = await Promise.all([
      fetchFromBackend(`/v1/lingapos/store/${storeId}/layout`),
      fetchFromBackend(`/v1/lingapos/store/${storeId}/users`),
    ]);
    if (floorData?.floors) aggregate.floors = floorData.floors;
    if (userData) aggregate.users = userData;
  } catch (e) {
    console.warn("Metadata fetch partial failure", e);
  }

  // 2. Fetch chunks
  for (let i = 0; i < chunks.length; i++) {
    const { from: chunkFrom, to: chunkTo } = chunks[i];
    const formattedFrom = formatDate(chunkFrom);
    const formattedTo = formatDate(chunkTo);

    onProgress?.(`Syncing Part ${i + 1}/${chunks.length}: ${formattedFrom}`);

    const endpoints = [
      `/v1/lingapos/store/${storeId}/getsale?fromDate=${formattedFrom}&toDate=${formattedTo}`,
      `/v1/lingapos/store/${storeId}/discountReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}&selectedReportType=By Discount Type`,
      `/v1/lingapos/store/${storeId}/saleReport?dateOption=DR&employeeGroup=N&fromDate=${formattedFrom}&toDate=${formattedTo}&isDetailedView=false&numberOfDay=&page=1&reportType=&selectedEmployee=&selectedItemId=&specificDate=&type=MENUITEM`,
      `/v1/lingapos/store/${storeId}/saleSummaryReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}`,
    ];

    try {
      const [salesData, discountData, menuData, saleSummaryData] =
        await Promise.all(endpoints.map((ep) => fetchFromBackend(ep)));

      // --- De-duplicate Sales & Payments ---
      if (salesData?.sales) {
        salesData.sales.forEach((sale: SaleOrder) => {
          if (!seenSaleIds.has(sale.id)) {
            seenSaleIds.add(sale.id);
            aggregate.sales.push(sale);

            // Payments
            if (sale.payments) {
              sale.payments.forEach((p: any) => {
                const name = p.paymentMethod || "Other";
                const type = p.paymentType || "Other";
                const existing = paymentMap.get(name) || {
                  amount: 0,
                  tips: 0,
                  count: 0,
                  type: type,
                };
                existing.amount += parseApiFloat(p.authorizedAmountStr);
                existing.tips += parseApiFloat(p.paymentTipStr);
                existing.count += 1;
                paymentMap.set(name, existing);
              });
            }

            // Menu Details (Individual items inside the sale)
            if (sale.orders) {
              sale.orders.forEach((order: any) => {
                aggregate.detailedMenu.push({
                  ...order,
                  saleId: sale.ticketNo,
                  saleDate: sale.startDate,
                });
                runningGross += parseApiFloat(order.grossAmountStr);
              });
            }
          }
        });
      }

      // --- De-duplicate Discounts ---
      if (Array.isArray(discountData)) {
        discountData.forEach((d: DiscountDetail) => {
          // Create a unique key for the discount record (Ticket# + DiscountName + Amount)
          const dKey = `${d.check}_${d.discountName}_${d.discountAmtStr}`;
          if (!seenDiscountIds.has(dKey)) {
            seenDiscountIds.add(dKey);
            aggregate.saleDetails.push(d);
          }
        });
      }

      // --- De-duplicate Sale Summaries ---
      if (Array.isArray(saleSummaryData)) {
        saleSummaryData.forEach((s: SaleSummary) => {
          const sKey = s.id || `summary_${s.saleOpenDate}`;
          const isDuplicate = aggregate.saleSummary.some(
            (existing) => existing.id === sKey
          );
          if (!isDuplicate) {
            aggregate.saleSummary.push(s);
          }
        });
      }

      // --- De-duplicate Menu Item Sales Report (The aggregate view) ---
      if (menuData?.data) {
        menuData.data.forEach((m: any) => {
          const mKey = m.menuName || m.id;
          const existingIdx = aggregate.menus.findIndex(
            (em) => em.menuName === mKey
          );
          if (existingIdx > -1) {
            // If already exists, we aggregate the values (since this is an item-level summary)
            aggregate.menus[existingIdx].quantity =
              (aggregate.menus[existingIdx].quantity || 0) + (m.quantity || 0);
            aggregate.menus[existingIdx].totalGrossAmountStr = (
              parseApiFloat(aggregate.menus[existingIdx].totalGrossAmountStr) +
              parseApiFloat(m.totalGrossAmountStr)
            ).toFixed(2);
          } else {
            aggregate.menus.push(m);
          }
        });
      }
    } catch (err: any) {
      console.error(
        `Error fetching chunk ${formattedFrom}-${formattedTo}:`,
        err
      );
      throw new Error(
        `Critical failure during data synchronization for range ${formattedFrom}. The server likely timed out processing this specific week.`
      );
    }
  }

  // Convert map to final payment summary
  aggregate.paymentSummary = Array.from(paymentMap.entries()).map(
    ([name, stats]) => ({
      name: name,
      type: stats.type,
      amount: stats.amount,
      tips: stats.tips,
      count: stats.count,
    })
  );
  aggregate.totalGrossAmount = runningGross.toFixed(2);

  return aggregate;
};
