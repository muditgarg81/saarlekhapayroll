export enum ComponentType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
}

export enum CalculationType {
  FIXED = 'FIXED',
  PERCENTAGE_OF_CTC = 'PERCENTAGE_OF_CTC',
  PERCENTAGE_OF_BASIC = 'PERCENTAGE_OF_BASIC',
  FORMULA = 'FORMULA',
}

export interface SalaryComponent {
  id: string;
  name: string;
  code: string; // e.g. BASIC, HRA, PF, PT
  type: ComponentType;
  calculationType: CalculationType;
  value: number; // percentage or fixed amount
  formula?: string; // e.g. "BASIC * 0.4"
  isTaxable: boolean;
  isStatutory: boolean; // PF, ESI, PT, LWF
  isActive: boolean;
  companyId: string;
}

export interface SalaryStructure {
  id: string;
  name: string;
  description?: string;
  components: SalaryStructureComponent[];
  companyId: string;
  isActive: boolean;
}

export interface SalaryStructureComponent {
  componentId: string;
  component?: SalaryComponent;
  order: number;
}

export interface EmployeeSalaryBreakdown {
  employeeId: string;
  ctc: number;
  monthly: number;
  earnings: ComponentValue[];
  deductions: ComponentValue[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

export interface ComponentValue {
  componentId: string;
  componentName: string;
  componentCode: string;
  amount: number;
}
