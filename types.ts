export interface User {
  username: string;
  password?: string;
  role: 'superuser' | 'admin' | 'user'; // 'superuser' = config access, 'admin' = read all stores, 'user' = specific stores
  name?: string;
  allowedStores?: string[]; // Array of Store IDs this user is authorized to access
}

export interface Store {
  id: string;
  name: string;
}

// API Response Types matching the LingaPOS structure
export interface SaleOrder {
  id: string;
  ticketNo: string;
  startDate: string; // ISO Date string
  saleOpenTime: string;
  customerName: string;
  tableNo: string;
  floorId: string;
  employee: string; // user ID
  saleCloseEmployee: string; // user ID
  guestCount: number;
  netSalesStr: string;
  grossAmountStr: string;
  totalTaxAmountStr: string;
  grossReceiptStr: string;
  orders?: MenuItemDetail[];
}

export interface SaleSummary {
  id: string; // Matches sale ID
  netSales: string;
  discounts: string;
  totalTaxAmount: string;
  saleOpenDate?: string;
}

export interface DiscountDetail {
  id: string;
  check: string; // Often matches ticketNo or SaleID
  approvedBy: string;
  date: string;
  discountAmtStr: string;
  discountAppliedBy: string;
  discountCoupon: string;
  discountName: string;
  discountType: string;
  grossSalesStr: string;
  isTotal: boolean;
  menuItems: string;
  percent: string;
  quantity: number;
  reason: string;
  totalDiscounts: string;
}

export interface Floor {
  id: string;
  floorName: string;
}

export interface StoreUser {
  id: string;
  name: string;
}

export interface MenuItemDetail {
  saleId: string;
  saleDate: string;
  orderHour: string;
  orderMin: string;
  departmentName: string;
  categoryName: string;
  subCategoryName: string;
  quantity: number;
  menuName: string;
  grossAmountStr: string;
  totalGrossAmountStr: string;
  totalDiscountAmountStr: string;
  isVoid: string;
  voidError: string;
  voidByEmployee: string;
}

export interface FetchedData {
  sales: SaleOrder[];
  saleDetails: DiscountDetail[];
  floors: Floor[];
  users: StoreUser[];
  menus: any[]; // Kept generic based on original code usage
  detailedMenu: MenuItemDetail[];
  totalGrossAmount: string;
  saleSummary: SaleSummary[];
  isSimulated?: boolean; // New flag to indicate data source
}