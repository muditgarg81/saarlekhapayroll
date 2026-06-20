export enum PayrunStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PayrunType {
  REGULAR = 'REGULAR',
  OFF_CYCLE = 'OFF_CYCLE',
  SUPPLEMENTARY = 'SUPPLEMENTARY',
  FULL_FINAL = 'FULL_FINAL',
}

export interface Payrun {
  id: string;
  companyId: string;
  month: number; // 1-12
  year: number;
  type: PayrunType;
  status: PayrunStatus;
  payDate?: string;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayslipLine {
  componentId: string;
  componentName: string;
  componentCode: string;
  type: 'EARNING' | 'DEDUCTION';
  amount: number;
}

export interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation: string;
    pan: string;
    uan?: string;
  };
  month: number;
  year: number;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  lines: PayslipLine[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: 'DRAFT' | 'FINALIZED';
}

export interface CreatePayrunDto {
  month: number;
  year: number;
  type: PayrunType;
  employeeIds?: string[]; // if empty, includes all active employees
  payDate?: string;
}

export interface PayrunSummary {
  payrunId: string;
  month: number;
  year: number;
  status: PayrunStatus;
  totalEmployees: number;
  totalGross: number;
  totalNetPay: number;
  totalTax: number;
  totalPF: number;
  totalESI: number;
}
