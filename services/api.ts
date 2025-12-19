
import { USE_MOCK_DATA } from '../constants';
import { FetchedData, SaleOrder, Floor, StoreUser, MenuItemDetail, SaleSummary, DiscountDetail, PaymentSummaryItem } from '../types';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

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
            payments: [{ paymentMethod: i % 2 === 0 ? 'Visa Card' : 'Cash', authorizedAmountStr: "200.00", paymentTipStr: "10.00" }]
        };
    });

    const mockDiscounts: DiscountDetail[] = [
        { id: "d1", check: "TKT-1001", approvedBy: "Manager", date: "2024-01-01", discountAmtStr: "250.00", discountAppliedBy: "Staff 1", discountCoupon: "STAFF50", discountName: "Staff Discount", discountType: "Percentage", grossSalesStr: "1000.00", isTotal: false, menuItems: "Burger", percent: "25", quantity: 10, reason: "Employee Meal", totalDiscounts: "250.00" },
        { id: "d2", check: "TKT-1005", approvedBy: "Admin", date: "2024-01-01", discountAmtStr: "500.00", discountAppliedBy: "Staff 2", discountCoupon: "COMP", discountName: "Manager Comp", discountType: "Amount", grossSalesStr: "1500.00", isTotal: false, menuItems: "Steak", percent: "0", quantity: 5, reason: "Service Delay", totalDiscounts: "500.00" },
    ];

    const mockDetailedMenu: MenuItemDetail[] = [
        { saleId: "TKT-1001", saleDate: "2024-01-01", orderHour: "09", orderMin: "30", departmentName: "Food", categoryName: "Breakfast", subCategoryName: "Eggs", quantity: 5, menuName: "Eggs Benedict", grossAmountStr: "45.00", totalGrossAmountStr: "225.00", totalDiscountAmountStr: "0.00", isVoid: "N", voidError: "", voidByEmployee: "" },
        { saleId: "TKT-1002", saleDate: "2024-01-01", orderHour: "13", orderMin: "15", departmentName: "Food", categoryName: "Main Course", subCategoryName: "Steak", quantity: 12, menuName: "Carrara T-bone", grossAmountStr: "1929.00", totalGrossAmountStr: "23148.00", totalDiscountAmountStr: "0.00", isVoid: "N", voidError: "", voidByEmployee: "" },
        { saleId: "TKT-1004", saleDate: "2024-01-01", orderHour: "20", orderMin: "45", departmentName: "Food", categoryName: "Set Menu", subCategoryName: "BSL", quantity: 2, menuName: "BSL SET MENU", grossAmountStr: "19720.00", totalGrossAmountStr: "39440.00", totalDiscountAmountStr: "0.00", isVoid: "N", voidError: "", voidByEmployee: "" }
    ];

    return {
        sales: mockSales,
        saleDetails: mockDiscounts,
        floors: [{ id: "floor_1", floorName: "Main Dining" }],
        users: [{ id: "emp_1", name: "Ahmed Manager" }],
        menus: [],
        detailedMenu: mockDetailedMenu,
        saleSummary: mockSales.map(s => ({ id: s.id, netSales: s.netSalesStr, totalTaxAmount: s.totalTaxAmountStr, discounts: "0.00" })),
        totalGrossAmount: "63913.00",
        paymentSummary: [
            { name: "Cash", amount: 15420.50, tips: 0, count: 12 },
            { name: "Visa Card", amount: 48950.00, tips: 500.00, count: 25 }
        ],
        isSimulated: true
    };
};

async function fetchFromBackend(endpoint: string): Promise<any> {
  const response = await fetch(`/api${endpoint}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Server Error (${response.status})`;
    try {
        const json = JSON.parse(errorBody);
        errorMessage = json.message || json.error || errorMessage;
    } catch(e) {}
    throw new Error(errorMessage);
  }
  return await response.json();
}

export const fetchDashboardData = async (storeId: string, from: Date, to: Date, forceMock: boolean = false): Promise<FetchedData> => {
  if (USE_MOCK_DATA || forceMock) {
    await new Promise(resolve => setTimeout(resolve, 800)); 
    return getMockData(storeId);
  }

  try {
    const formattedFrom = formatDate(from);
    const formattedTo = formatDate(to);
    
    const endpoints = [
      `/v1/lingapos/store/${storeId}/getsale?fromDate=${formattedFrom}&toDate=${formattedTo}`,
      `/v1/lingapos/store/${storeId}/discountReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}&selectedReportType=By Discount Type`,
      `/v1/lingapos/store/${storeId}/layout`,
      `/v1/lingapos/store/${storeId}/users`,
      `/v1/lingapos/store/${storeId}/saleReport?dateOption=DR&employeeGroup=N&fromDate=${formattedFrom}&toDate=${formattedTo}&isDetailedView=false&numberOfDay=&page=1&reportType=&selectedEmployee=&selectedItemId=&specificDate=&type=MENUITEM`,
      `/v1/lingapos/store/${storeId}/saleSummaryReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}`,
    ];

    const responses = await Promise.all(endpoints.map(ep => fetchFromBackend(ep)));
    const [salesData, discountData, floorData, userData, menuData, saleSummaryData] = responses;

    const allOrders: MenuItemDetail[] = [];
    let totalGross = 0;
    const paymentMap = new Map<string, { amount: number, tips: number, count: number }>();

    if (salesData && salesData.sales) {
        salesData.sales.forEach((sale: SaleOrder) => {
            // Aggregate payments if available (using the deep structure provided in prompt)
            if (sale.payments) {
                sale.payments.forEach((p: any) => {
                    const name = p.paymentMethod || 'Other';
                    const existing = paymentMap.get(name) || { amount: 0, tips: 0, count: 0 };
                    const amt = parseFloat(p.authorizedAmountStr || "0");
                    const tip = parseFloat(p.paymentTipStr || "0");
                    existing.amount += amt;
                    existing.tips += tip;
                    existing.count += 1;
                    paymentMap.set(name, existing);
                });
            }

            if (sale.orders) {
                sale.orders.forEach((order: any) => {
                    allOrders.push({
                      ...order,
                      saleId: sale.ticketNo,
                      saleDate: sale.startDate,
                    });
                    totalGross += parseFloat(order.grossAmountStr || "0");
                });
            }
        });
    }

    const paymentSummary: PaymentSummaryItem[] = Array.from(paymentMap.entries()).map(([name, stats]) => ({
        name,
        amount: stats.amount,
        tips: stats.tips,
        count: stats.count
    }));

    return {
      sales: salesData?.sales || [],
      saleDetails: discountData || [],
      floors: floorData?.floors || [],
      users: userData || [],
      menus: menuData?.data || [],
      detailedMenu: allOrders,
      saleSummary: saleSummaryData || [],
      totalGrossAmount: totalGross.toFixed(2),
      paymentSummary: paymentSummary,
      isSimulated: false
    };
  } catch (err: any) {
    console.warn("Fetch failed:", err);
    throw err; 
  }
};
