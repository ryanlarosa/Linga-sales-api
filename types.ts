
export interface User {
  username: string;
  password?: string;
  role: 'superuser' | 'admin' | 'user'; 
  name?: string;
  allowedStores?: string[]; 
}

export interface Store {
  id: string;
  name: string;
}

export interface SaleOrder {
  id: string;
  ticketNo: string;
  startDate: string; 
  saleOpenTime: string;
  customerName: string;
  tableNo: string;
  floorId: string;
  employee: string; 
  saleCloseEmployee: string; 
  guestCount: number;
  netSalesStr: string;
  grossAmountStr: string;
  totalTaxAmountStr: string;
  grossReceiptStr: string;
  payments?: { 
    paymentMethod: string, 
    authorizedAmountStr: string, 
    paymentTipStr: string 
  }[];
  orders?: MenuItemDetail[];
}

export interface SaleSummary {
  id: string; 
  netSales: string;
  discounts: string;
  totalTaxAmount: string;
  saleOpenDate?: string;
}

export interface DiscountDetail {
  id: string;
  check: string; 
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

export interface PaymentSummaryItem {
  name: string;
  amount: number;
  tips: number;
  count: number;
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
  menus: any[]; 
  detailedMenu: MenuItemDetail[];
  totalGrossAmount: string;
  saleSummary: SaleSummary[];
  paymentSummary?: PaymentSummaryItem[]; 
  isSimulated?: boolean; 
}
