export type PaymentMethod = "cash" | "loan" | "debt";
export type ExpenseType = "daily" | "monthly_obligation" | "purchase";
export type SellType = "cards" | "broadband";
export type ObligationStatus = "permanent" | "ended";

export interface FinanceSummary {
  totalOwed: number;
  totalLoans: number;
  cashBox: number;
  totalCustody: number;
  totalCards: number;
  financeManagerName: string;
}

export interface SaleRecord {
  id: number;
  entityName: string;
  type: SellType;
  amount: number;
  paymentMethod: "cash" | "loan";
  date: string;
}

export interface ExpenseRecord {
  id: number;
  name: string;
  type: ExpenseType;
  amount: number;
  paymentMethod: "cash" | "debt";
  date: string;
}

export interface LoanRecord {
  id: number;
  entityName: string;
  total: number;
  paid: number;
  remaining: number;
}

export interface DebtRecord {
  id: number;
  entityName: string;
  total: number;
  paid: number;
  remaining: number;
}

export interface CustodyRecord {
  id: number;
  recipientName: string;
  custodyValue: number;
  cashReturned: number;
  cardsReturned: number;
  isSettled: boolean;
  sentAt: string;
}

export interface PurchaseRequest {
  id: number;
  requestedBy: string;
  description: string;
  amount: number | null;
  status: string;
  createdAt: string;
}

export interface ExpenseTemplate {
  id: number;
  name: string;
}

export interface Obligation {
  id: number;
  name: string;
  startDate: string;
  status: ObligationStatus;
  monthlyAmount: number;
  totalPaid: number;
  endDate?: string;
}

export const mockSummary: FinanceSummary = {
  financeManagerName: "أحمد محمود",
  totalOwed: 125000,
  totalLoans: 48500,
  cashBox: 31200,
  totalCustody: 22000,
  totalCards: 67800,
};

export const mockPurchaseRequests: PurchaseRequest[] = [
  { id: 1, requestedBy: "محمد علي", description: "شراء راوترات جديدة", amount: 5000, status: "pending", createdAt: "2026-03-28 10:30" },
  { id: 2, requestedBy: "سامر خالد", description: "تجديد اشتراكات البنية التحتية", amount: 12000, status: "pending", createdAt: "2026-03-27 14:20" },
  { id: 3, requestedBy: "هاني نجيب", description: "شراء كروت شحن إضافية", amount: null, status: "pending", createdAt: "2026-03-26 09:15" },
];

export const mockSales: SaleRecord[] = [
  { id: 1, entityName: "نقطة بيع الرئيسية", type: "cards", amount: 1500, paymentMethod: "cash", date: "2026-03-28 11:00" },
  { id: 2, entityName: "شركة الاتصالات", type: "broadband", amount: 3200, paymentMethod: "loan", date: "2026-03-28 09:30" },
  { id: 3, entityName: "نقطة بيع الفرع", type: "cards", amount: 800, paymentMethod: "cash", date: "2026-03-27 16:45" },
  { id: 4, entityName: "مشترك جديد", type: "broadband", amount: 1200, paymentMethod: "cash", date: "2026-03-27 12:00" },
  { id: 5, entityName: "نقطة بيع الجنوب", type: "cards", amount: 2100, paymentMethod: "loan", date: "2026-03-26 10:20" },
  { id: 6, entityName: "عميل VIP", type: "broadband", amount: 4500, paymentMethod: "cash", date: "2026-03-25 14:30" },
];

export const mockExpenses: ExpenseRecord[] = [
  { id: 1, name: "إيجار المكتب", type: "monthly_obligation", amount: 5000, paymentMethod: "cash", date: "2026-03-01" },
  { id: 2, name: "فاتورة كهرباء", type: "daily", amount: 350, paymentMethod: "cash", date: "2026-03-28" },
  { id: 3, name: "شراء قرطاسية", type: "daily", amount: 120, paymentMethod: "cash", date: "2026-03-27" },
  { id: 4, name: "صيانة أجهزة", type: "purchase", amount: 1800, paymentMethod: "debt", date: "2026-03-25" },
  { id: 5, name: "راتب موظف", type: "monthly_obligation", amount: 8000, paymentMethod: "cash", date: "2026-03-01" },
  { id: 6, name: "وقود", type: "daily", amount: 200, paymentMethod: "cash", date: "2026-03-26" },
];

export const mockLoans: LoanRecord[] = [
  { id: 1, entityName: "نقطة بيع الشمال", total: 15000, paid: 8000, remaining: 7000 },
  { id: 2, entityName: "أبو كريم", total: 5500, paid: 2000, remaining: 3500 },
  { id: 3, entityName: "شركة التقنية", total: 22000, paid: 10000, remaining: 12000 },
  { id: 4, entityName: "عمر المحمد", total: 3200, paid: 3200, remaining: 0 },
  { id: 5, entityName: "نقطة بيع الغرب", total: 8800, paid: 5000, remaining: 3800 },
];

export const mockDebts: DebtRecord[] = [
  { id: 1, entityName: "مورد الكروت الرئيسي", total: 30000, paid: 15000, remaining: 15000 },
  { id: 2, entityName: "شركة الصيانة", total: 4500, paid: 1800, remaining: 2700 },
  { id: 3, entityName: "موردو الأجهزة", total: 18000, paid: 10000, remaining: 8000 },
];

export const mockCustodies: CustodyRecord[] = [
  { id: 1, recipientName: "خالد سعد", custodyValue: 10000, cashReturned: 0, cardsReturned: 0, isSettled: false, sentAt: "2026-03-20" },
  { id: 2, recipientName: "فارس عمر", custodyValue: 8000, cashReturned: 5000, cardsReturned: 3000, isSettled: true, sentAt: "2026-03-10" },
  { id: 3, recipientName: "ناصر أحمد", custodyValue: 12000, cashReturned: 0, cardsReturned: 0, isSettled: false, sentAt: "2026-03-22" },
];

export const mockExpenseTemplates: ExpenseTemplate[] = [
  { id: 1, name: "إيجار المكتب" },
  { id: 2, name: "فاتورة الكهرباء" },
  { id: 3, name: "وقود" },
  { id: 4, name: "قرطاسية" },
  { id: 5, name: "صيانة" },
];

export const mockObligations: Obligation[] = [
  { id: 1, name: "إيجار المكتب الرئيسي", startDate: "2024-01-01", status: "permanent", monthlyAmount: 5000, totalPaid: 75000 },
  { id: 2, name: "راتب موظف المحاسبة", startDate: "2023-06-01", status: "permanent", monthlyAmount: 8000, totalPaid: 264000 },
  { id: 3, name: "اشتراك الإنترنت", startDate: "2025-01-01", status: "ended", monthlyAmount: 1500, totalPaid: 18000, endDate: "2026-01-01" },
];

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("ar-SA") + " ر.س";
}
