// ─── Professional Tax Slabs ───────────────────────────────────
// Each entry: { upTo: monthly gross (Infinity = no upper limit), tax: monthly PT }
// Source: respective state PT acts (as of FY 2024-25)
export type PTSlabEntry = { upTo: number; tax: number };

export const PT_SLABS: Record<string, PTSlabEntry[]> = {
  'Maharashtra': [
    { upTo: 7500,    tax: 0   },
    { upTo: 10000,   tax: 175 },
    { upTo: Infinity, tax: 200 }, // 300 in February — handled at calc time
  ],
  'Karnataka': [
    { upTo: 15000,   tax: 0   },
    { upTo: 25000,   tax: 150 },
    { upTo: 35000,   tax: 175 },
    { upTo: Infinity, tax: 200 },
  ],
  'Tamil Nadu': [
    { upTo: 3500,    tax: 0    },
    { upTo: 5000,    tax: 16   },
    { upTo: 7500,    tax: 23   },
    { upTo: 10000,   tax: 35   },
    { upTo: 12500,   tax: 45   },
    { upTo: Infinity, tax: 90  },
  ],
  'Andhra Pradesh': [
    { upTo: 15000,   tax: 0   },
    { upTo: 20000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'Telangana': [
    { upTo: 15000,   tax: 0   },
    { upTo: 20000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'West Bengal': [
    { upTo: 10000,   tax: 0   },
    { upTo: 15000,   tax: 110 },
    { upTo: 25000,   tax: 130 },
    { upTo: 40000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'Gujarat': [
    { upTo: 6000,    tax: 0   },
    { upTo: 8999,    tax: 80  },
    { upTo: 11999,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'Kerala': [
    { upTo: 11999,   tax: 0   },
    { upTo: 17999,   tax: 120 },
    { upTo: 29999,   tax: 180 },
    { upTo: Infinity, tax: 200 },
  ],
  'Madhya Pradesh': [
    { upTo: 25000,   tax: 0   },
    { upTo: Infinity, tax: 208 },
  ],
  'Odisha': [
    { upTo: 13304,   tax: 0   },
    { upTo: 25000,   tax: 125 },
    { upTo: Infinity, tax: 200 },
  ],
  'Assam': [
    { upTo: 10000,   tax: 0   },
    { upTo: 15000,   tax: 150 },
    { upTo: Infinity, tax: 208 },
  ],
  'Jharkhand': [
    { upTo: 25000,   tax: 0   },
    { upTo: 41666,   tax: 100 },
    { upTo: Infinity, tax: 150 },
  ],
  'Punjab': [
    { upTo: 17500,   tax: 0   },
    { upTo: 25000,   tax: 150 },
    { upTo: 37500,   tax: 175 },
    { upTo: Infinity, tax: 208 },
  ],
  'Haryana': [
    { upTo: 7500,    tax: 0   },
    { upTo: 25000,   tax: 150 },
    { upTo: Infinity, tax: 208 },
  ],
  'Chhattisgarh': [
    { upTo: 5800,    tax: 0   },
    { upTo: Infinity, tax: 200 },
  ],
  'Meghalaya': [
    { upTo: 4999,    tax: 0   },
    { upTo: 6999,    tax: 16  },
    { upTo: 8999,    tax: 25  },
    { upTo: 11999,   tax: 33  },
    { upTo: 14999,   tax: 83  },
    { upTo: Infinity, tax: 208 },
  ],
  'Sikkim': [
    { upTo: 20000,   tax: 0   },
    { upTo: 30000,   tax: 125 },
    { upTo: 40000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'Tripura': [
    { upTo: 7500,    tax: 0   },
    { upTo: 15000,   tax: 100 },
    { upTo: 25000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
  'Manipur': [
    { upTo: 5000,    tax: 0   },
    { upTo: 10000,   tax: 100 },
    { upTo: 20000,   tax: 150 },
    { upTo: Infinity, tax: 208 },
  ],
  'Mizoram': [
    { upTo: 3000,    tax: 0   },
    { upTo: 5000,    tax: 30  },
    { upTo: 8000,    tax: 75  },
    { upTo: 10000,   tax: 100 },
    { upTo: Infinity, tax: 208 },
  ],
  'Nagaland': [
    { upTo: 5000,    tax: 0   },
    { upTo: 10000,   tax: 75  },
    { upTo: 20000,   tax: 150 },
    { upTo: Infinity, tax: 208 },
  ],
  'Bihar': [
    { upTo: 25000,   tax: 0   },
    { upTo: Infinity, tax: 208 },
  ],
  'Rajasthan': [
    // Rajasthan does not levy PT — no entry means ₹0
  ],
  'Himachal Pradesh': [],
  'Uttarakhand': [],
  'Uttar Pradesh': [],
  'Delhi': [],
  'Jammu & Kashmir': [],
  'Ladakh': [],
  'Chandigarh': [],
  'Puducherry': [
    { upTo: 5000,    tax: 0   },
    { upTo: 10000,   tax: 100 },
    { upTo: Infinity, tax: 150 },
  ],
  'Goa': [
    { upTo: 15000,   tax: 0   },
    { upTo: 25000,   tax: 150 },
    { upTo: Infinity, tax: 200 },
  ],
};

// Maharashtra February special rule
export const MAHARASHTRA_FEB_EXTRA = 100; // 200 + 100 = 300 in Feb

// ─── Labour Welfare Fund ──────────────────────────────────────
// frequency: MONTHLY | JUNE_DEC | ANNUAL
export type LWFRate = {
  employee: number;
  employer: number;
  frequency: 'MONTHLY' | 'JUNE_DEC' | 'ANNUAL';
};

export const LWF_RATES: Record<string, LWFRate> = {
  'Maharashtra':    { employee: 6,   employer: 12,  frequency: 'JUNE_DEC' },
  'Karnataka':      { employee: 20,  employer: 40,  frequency: 'ANNUAL'   },
  'Tamil Nadu':     { employee: 10,  employer: 20,  frequency: 'ANNUAL'   },
  'Andhra Pradesh': { employee: 30,  employer: 70,  frequency: 'ANNUAL'   },
  'Telangana':      { employee: 30,  employer: 70,  frequency: 'ANNUAL'   },
  'Gujarat':        { employee: 6,   employer: 12,  frequency: 'JUNE_DEC' },
  'Kerala':         { employee: 4,   employer: 8,   frequency: 'ANNUAL'   },
  'Madhya Pradesh': { employee: 10,  employer: 25,  frequency: 'JUNE_DEC' },
  'Chhattisgarh':   { employee: 10,  employer: 25,  frequency: 'JUNE_DEC' },
  'Punjab':         { employee: 5,   employer: 5,   frequency: 'ANNUAL'   },
  'Haryana':        { employee: 5,   employer: 5,   frequency: 'ANNUAL'   },
  'Odisha':         { employee: 3,   employer: 6,   frequency: 'JUNE_DEC' },
  'West Bengal':    { employee: 3,   employer: 3,   frequency: 'ANNUAL'   },
  'Goa':            { employee: 60,  employer: 120, frequency: 'ANNUAL'   },
};

// ─── PF/EPF constants ─────────────────────────────────────────
export const PF_WAGE_CEILING    = 15000;  // ₹ per month — cap for PF calc
export const PF_EMPLOYEE_RATE   = 0.12;   // 12% of capped wage
export const PF_EPF_EMPLOYER    = 0.0367; // 3.67% to EPF
export const PF_EPS_EMPLOYER    = 0.0833; // 8.33% to EPS
export const PF_EDLI_EMPLOYER   = 0.005;  // 0.50% EDLI insurance
export const PF_ADMIN_EMPLOYER  = 0.005;  // 0.50% admin charges

// ─── ESI constants ────────────────────────────────────────────
export const ESI_GROSS_CEILING   = 21000; // ₹ — employees above this are exempt
export const ESI_EMPLOYEE_RATE   = 0.0075;
export const ESI_EMPLOYER_RATE   = 0.0325;

// ─── Statutory Bonus (Payment of Bonus Act) ───────────────────
export const BONUS_MIN_RATE      = 0.0833; // 8.33% of wages
export const BONUS_MAX_RATE      = 0.20;   // 20% of wages
export const BONUS_WAGE_CEILING  = 21000;  // eligibility ceiling ₹/month
export const BONUS_CALC_CAP      = 7000;   // calculation cap (or min wage if higher)

// ─── Gratuity (Payment of Gratuity Act) ──────────────────────
export const GRATUITY_MIN_SERVICE_YEARS = 5;
export const GRATUITY_RATE_NUMERATOR    = 15;
export const GRATUITY_RATE_DENOMINATOR  = 26;
export const GRATUITY_MAX_AMOUNT        = 2000000; // ₹20 lakh ceiling
