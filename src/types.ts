export interface CostByBusType {
  type: 'MICEOBÚS' | 'AUTOCAR GRANDE' | 'AUTOCAR NORMAL';
  costPerHour: number;
  costPerKm: number;
}

export interface IncomeData {
  total: number;
  own: number;
  subcontracted: number;
}

export interface ProfitAndLossItem {
  concept: string;
  amount: number;
  coefficient: number;
}

export interface BalanceSheetItem {
  concept: string;
  currentYear: number;
  previousYear: number;
  variation: number;
}

export interface FinancialRatio {
  ratio: string;
  currentYear: number | string;
  previousYear: number | string;
  variation: number;
  optimalValue: string;
  interpretation?: string;
}

export type CostCenter = 'DIRECTO' | 'INDIRECTO';
export type Nature = 'FIJO' | 'VARIABLE';
export type DistributionBasis = 'Kilómetros' | 'Meses';

export interface CostClassificationItem {
  id: number;
  costType: string;
  amount: number;
  costCenter: CostCenter;
  nature: Nature;
  distribution: string; // Can be 'General', 'otras empresas', 'amortización', or a license plate string
  distributionBasis: DistributionBasis;
}


export interface Vehicle {
  id: string; // Using license plate as a unique ID
  licensePlate: string;
  assignedNumber: number;
  acquisitionDate: string; // YYYY-MM-DD
  saleDate?: string; // YYYY-MM-DD
  acquisitionValue: number;
  saleValue?: number;
  annualAmortization: number;
  seats: number;
  wheels: number;
  type: 'Normal' | 'Micro' | 'Grande';
  annualKms: Record<number, number>; // { 2023: 120000, 2024: 150000 }
}

export interface AmortizationAccount {
  id: string;
  name: string;
  totalValue: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  annualAmount: number;
  annualValues: Record<number, number>; // { 2023: 10000, 2024: 10000 }
}

// --- Monthly Income Types ---
export type MonthlyIncomeRecord = Record<number, number>; // month (1-12) -> amount

export interface VehicleIncome {
  id: string; // licensePlate
  assignedNumber: number;
  licensePlate: string;
  income: MonthlyIncomeRecord;
}

export interface YearlyIncomeData {
  year: number;
  ownFleet: VehicleIncome[];
  subcontracted: MonthlyIncomeRecord;
}
