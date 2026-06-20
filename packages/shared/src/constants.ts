export const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
] as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const FINANCIAL_YEAR_START_MONTH = 4; // April

export const DEFAULT_SALARY_COMPONENTS = [
  // ── Earnings ──────────────────────────────────────────────
  { code: 'BASIC',   name: 'Basic Salary',              type: 'EARNING',    calculationType: 'PERCENTAGE_OF_CTC',   value: 40 },
  { code: 'HRA',     name: 'House Rent Allowance',       type: 'EARNING',    calculationType: 'PERCENTAGE_OF_BASIC', value: 50 },
  { code: 'DA',      name: 'Dearness Allowance',         type: 'EARNING',    calculationType: 'PERCENTAGE_OF_BASIC', value: 10 },
  { code: 'LTA',     name: 'Leave Travel Allowance',     type: 'EARNING',    calculationType: 'FIXED',               value: 0 },
  { code: 'BONUS',   name: 'Performance Bonus',          type: 'EARNING',    calculationType: 'FIXED',               value: 0 },
  { code: 'SA',      name: 'Special Allowance',          type: 'EARNING',    calculationType: 'FORMULA',             value: 0,
    formula: 'MONTHLY_CTC - BASIC - HRA - DA - LTA - PF_EMPLOYER' },
  // ── Statutory Deductions ──────────────────────────────────
  { code: 'PF_EMPLOYEE',  name: 'PF (Employee)',         type: 'DEDUCTION',  calculationType: 'PERCENTAGE_OF_BASIC', value: 12,   isStatutory: true },
  { code: 'ESI_EMPLOYEE', name: 'ESI (Employee)',        type: 'DEDUCTION',  calculationType: 'PERCENTAGE_OF_GROSS', value: 0.75, isStatutory: true },
  { code: 'PT',           name: 'Professional Tax',      type: 'DEDUCTION',  calculationType: 'FIXED',               value: 0,    isStatutory: true },
  { code: 'LWF',          name: 'Labour Welfare Fund',   type: 'DEDUCTION',  calculationType: 'FIXED',               value: 0,    isStatutory: true },
  { code: 'TDS',          name: 'TDS (Income Tax)',      type: 'DEDUCTION',  calculationType: 'FORMULA',             value: 0,    isStatutory: true },
  // ── Non-statutory Deductions ──────────────────────────────
  { code: 'LOAN_EMI', name: 'Loan EMI',                 type: 'DEDUCTION',  calculationType: 'FIXED',               value: 0 },
] as const;

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HR_MANAGER: 'HR_MANAGER',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const API_ROUTES = {
  AUTH: '/auth',
  EMPLOYEES: '/employees',
  DEPARTMENTS: '/departments',
  SALARY: '/salary',
  PAYRUN: '/payrun',
  PAYSLIPS: '/payslips',
  LEAVE: '/leave',
  ATTENDANCE: '/attendance',
  COMPLIANCE: '/compliance',
  REPORTS: '/reports',
  COMPANY: '/company',
} as const;
