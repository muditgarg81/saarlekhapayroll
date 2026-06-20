export enum TaxRegime {
  OLD = 'OLD',
  NEW = 'NEW',
}

export interface TaxSlab {
  minIncome: number;
  maxIncome: number | null;
  rate: number; // percentage
  surchargeRate?: number;
}

export const OLD_REGIME_SLABS: TaxSlab[] = [
  { minIncome: 0, maxIncome: 250000, rate: 0 },
  { minIncome: 250001, maxIncome: 500000, rate: 5 },
  { minIncome: 500001, maxIncome: 1000000, rate: 20 },
  { minIncome: 1000001, maxIncome: null, rate: 30 },
];

export const NEW_REGIME_SLABS: TaxSlab[] = [
  { minIncome: 0, maxIncome: 300000, rate: 0 },
  { minIncome: 300001, maxIncome: 600000, rate: 5 },
  { minIncome: 600001, maxIncome: 900000, rate: 10 },
  { minIncome: 900001, maxIncome: 1200000, rate: 15 },
  { minIncome: 1200001, maxIncome: 1500000, rate: 20 },
  { minIncome: 1500001, maxIncome: null, rate: 30 },
];

export interface PFConfig {
  employeeContributionRate: number; // 12%
  employerEPFRate: number; // 3.67%
  employerEPSRate: number; // 8.33%
  employerEDLIRate: number; // 0.5%
  wageLimit: number; // 15000
}

export const DEFAULT_PF_CONFIG: PFConfig = {
  employeeContributionRate: 12,
  employerEPFRate: 3.67,
  employerEPSRate: 8.33,
  employerEDLIRate: 0.5,
  wageLimit: 15000,
};

export interface ESIConfig {
  employeeContributionRate: number; // 0.75%
  employerContributionRate: number; // 3.25%
  wageLimit: number; // 21000
}

export const DEFAULT_ESI_CONFIG: ESIConfig = {
  employeeContributionRate: 0.75,
  employerContributionRate: 3.25,
  wageLimit: 21000,
};

// Professional Tax slabs by state
export interface PTSlab {
  minSalary: number;
  maxSalary: number | null;
  monthlyTax: number;
}

export interface StatePTConfig {
  state: string;
  stateCode: string;
  slabs: PTSlab[];
}

export const PT_CONFIG: StatePTConfig[] = [
  {
    state: 'Maharashtra',
    stateCode: 'MH',
    slabs: [
      { minSalary: 0, maxSalary: 7500, monthlyTax: 0 },
      { minSalary: 7501, maxSalary: 10000, monthlyTax: 175 },
      { minSalary: 10001, maxSalary: null, monthlyTax: 200 },
    ],
  },
  {
    state: 'Karnataka',
    stateCode: 'KA',
    slabs: [
      { minSalary: 0, maxSalary: 15000, monthlyTax: 0 },
      { minSalary: 15001, maxSalary: 25000, monthlyTax: 150 },
      { minSalary: 25001, maxSalary: 35000, monthlyTax: 200 },
      { minSalary: 35001, maxSalary: null, monthlyTax: 200 },
    ],
  },
  {
    state: 'West Bengal',
    stateCode: 'WB',
    slabs: [
      { minSalary: 0, maxSalary: 10000, monthlyTax: 0 },
      { minSalary: 10001, maxSalary: 15000, monthlyTax: 110 },
      { minSalary: 15001, maxSalary: 25000, monthlyTax: 130 },
      { minSalary: 25001, maxSalary: 40000, monthlyTax: 150 },
      { minSalary: 40001, maxSalary: null, monthlyTax: 200 },
    ],
  },
  {
    state: 'Tamil Nadu',
    stateCode: 'TN',
    slabs: [
      { minSalary: 0, maxSalary: 21000, monthlyTax: 0 },
      { minSalary: 21001, maxSalary: null, monthlyTax: 208 },
    ],
  },
  {
    state: 'Andhra Pradesh',
    stateCode: 'AP',
    slabs: [
      { minSalary: 0, maxSalary: 15000, monthlyTax: 0 },
      { minSalary: 15001, maxSalary: 20000, monthlyTax: 150 },
      { minSalary: 20001, maxSalary: null, monthlyTax: 200 },
    ],
  },
  {
    state: 'Telangana',
    stateCode: 'TG',
    slabs: [
      { minSalary: 0, maxSalary: 15000, monthlyTax: 0 },
      { minSalary: 15001, maxSalary: 20000, monthlyTax: 150 },
      { minSalary: 20001, maxSalary: null, monthlyTax: 200 },
    ],
  },
  {
    state: 'Gujarat',
    stateCode: 'GJ',
    slabs: [
      { minSalary: 0, maxSalary: 5999, monthlyTax: 0 },
      { minSalary: 6000, maxSalary: 8999, monthlyTax: 80 },
      { minSalary: 9000, maxSalary: 11999, monthlyTax: 150 },
      { minSalary: 12000, maxSalary: null, monthlyTax: 200 },
    ],
  },
];

export interface TDSDeclaration {
  employeeId: string;
  financialYear: string;
  regime: TaxRegime;
  section80C: number;
  section80D: number;
  section80G: number;
  hraExemption: number;
  ltaExemption: number;
  otherDeductions: number;
  homeLoanInterest: number;
}
