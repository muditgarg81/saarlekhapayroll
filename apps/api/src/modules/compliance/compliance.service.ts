import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PT_SLABS, PTSlabEntry, LWF_RATES, MAHARASHTRA_FEB_EXTRA,
  PF_WAGE_CEILING, PF_EMPLOYEE_RATE, PF_EPF_EMPLOYER, PF_EPS_EMPLOYER, PF_EDLI_EMPLOYER, PF_ADMIN_EMPLOYER,
  ESI_GROSS_CEILING, ESI_EMPLOYEE_RATE, ESI_EMPLOYER_RATE,
  BONUS_MIN_RATE, BONUS_WAGE_CEILING, BONUS_CALC_CAP,
  GRATUITY_MIN_SERVICE_YEARS, GRATUITY_RATE_NUMERATOR, GRATUITY_RATE_DENOMINATOR, GRATUITY_MAX_AMOUNT,
} from '@saarlekha/shared';

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  // ── PF/EPF Challan ────────────────────────────────────────
  async pfChallan(companyId: string, month: number, year: number) {
    const payslips = await this.getPayslips(companyId, month, year);

    const rows = payslips.map(ps => {
      const basic       = this.getComp(ps, 'BASIC');
      const cappedWage  = Math.min(basic, PF_WAGE_CEILING);
      const employeeEPF = Math.round(cappedWage * PF_EMPLOYEE_RATE);
      const employerEPF = Math.round(cappedWage * PF_EPF_EMPLOYER);
      const employerEPS = Math.round(cappedWage * PF_EPS_EMPLOYER);
      const edli        = Math.round(cappedWage * PF_EDLI_EMPLOYER);
      const adminCharge = Math.round(cappedWage * PF_ADMIN_EMPLOYER);
      return {
        employeeCode:      ps.employee.employeeCode,
        name:              `${ps.employee.firstName} ${ps.employee.lastName}`,
        uan:               (ps.employee as any).uan || '—',
        pan:               (ps.employee as any).pan || '—',
        basic,
        cappedWage,
        employeeEPF,
        employerEPF,
        employerEPS,
        edli,
        adminCharge,
        totalEmployerCont: employerEPF + employerEPS + edli + adminCharge,
        grandTotal:        employeeEPF + employerEPF + employerEPS + edli + adminCharge,
      };
    });

    const totals = rows.reduce(
      (a, r) => ({
        employeeEPF: a.employeeEPF + r.employeeEPF,
        employerEPF: a.employerEPF + r.employerEPF,
        employerEPS: a.employerEPS + r.employerEPS,
        edli:        a.edli        + r.edli,
        adminCharge: a.adminCharge + r.adminCharge,
        grandTotal:  a.grandTotal  + r.grandTotal,
      }),
      { employeeEPF: 0, employerEPF: 0, employerEPS: 0, edli: 0, adminCharge: 0, grandTotal: 0 },
    );

    return { month, year, count: rows.length, rows, totals };
  }

  // ── ESI Challan ───────────────────────────────────────────
  async esiChallan(companyId: string, month: number, year: number) {
    const payslips = await this.getPayslips(companyId, month, year);

    const rows = payslips
      .filter(ps => ps.grossEarnings <= ESI_GROSS_CEILING)
      .map(ps => {
        const employeeESI = Math.round(ps.grossEarnings * ESI_EMPLOYEE_RATE);
        const employerESI = Math.round(ps.grossEarnings * ESI_EMPLOYER_RATE);
        return {
          employeeCode: ps.employee.employeeCode,
          name:         `${ps.employee.firstName} ${ps.employee.lastName}`,
          esiNumber:    (ps.employee as any).esiNumber || '—',
          grossWage:    Math.round(ps.grossEarnings),
          employeeESI,
          employerESI,
          total:        employeeESI + employerESI,
        };
      });

    const totals = rows.reduce(
      (a, r) => ({ employeeESI: a.employeeESI + r.employeeESI, employerESI: a.employerESI + r.employerESI, total: a.total + r.total }),
      { employeeESI: 0, employerESI: 0, total: 0 },
    );

    return { month, year, eligibleCount: rows.length, rows, totals };
  }

  // ── Professional Tax Register ─────────────────────────────
  async ptRegister(companyId: string, month: number, year: number, stateFilter?: string) {
    const payslips = await this.getPayslips(companyId, month, year);
    const isFeb    = month === 2;

    let rows = payslips.map(ps => {
      const emp   = ps.employee as any;
      const state = emp.branch?.state || emp.state || '';
      const pt    = this.calcPT(state, ps.grossEarnings, isFeb);
      return {
        employeeCode: ps.employee.employeeCode,
        name:         `${ps.employee.firstName} ${ps.employee.lastName}`,
        state,
        grossWage:    Math.round(ps.grossEarnings),
        pt,
      };
    });

    if (stateFilter) rows = rows.filter(r => r.state === stateFilter);

    const byState: Record<string, { count: number; total: number; levies: boolean }> = {};
    for (const r of rows) {
      if (!byState[r.state]) byState[r.state] = { count: 0, total: 0, levies: !!PT_SLABS[r.state]?.length };
      byState[r.state].count++;
      byState[r.state].total += r.pt;
    }

    return { month, year, stateFilter: stateFilter || null, rows, byState, totalPT: rows.reduce((s, r) => s + r.pt, 0) };
  }

  // ── LWF Register ─────────────────────────────────────────
  async lwfRegister(companyId: string, month: number, year: number, stateFilter?: string) {
    const payslips = await this.getPayslips(companyId, month, year);
    const isJune   = month === 6;
    const isDec    = month === 12;

    const rows: any[] = [];
    for (const ps of payslips) {
      const emp   = ps.employee as any;
      const state = emp.branch?.state || emp.state || '';
      if (stateFilter && state !== stateFilter) continue;
      const rate  = LWF_RATES[state];
      if (!rate) continue;
      const ok =
        rate.frequency === 'MONTHLY' ||
        (rate.frequency === 'JUNE_DEC' && (isJune || isDec)) ||
        (rate.frequency === 'ANNUAL'   && isDec);
      if (!ok) continue;
      rows.push({
        employeeCode:    ps.employee.employeeCode,
        name:            `${ps.employee.firstName} ${ps.employee.lastName}`,
        state,
        frequency:       rate.frequency,
        employeeContrib: rate.employee,
        employerContrib: rate.employer,
        total:           rate.employee + rate.employer,
      });
    }

    const totals = rows.reduce(
      (a, r) => ({ employee: a.employee + r.employeeContrib, employer: a.employer + r.employerContrib, total: a.total + r.total }),
      { employee: 0, employer: 0, total: 0 },
    );

    return { month, year, stateFilter: stateFilter || null, rows, totals };
  }

  // ── States present in the workforce (for state filter) ────
  async getStates(companyId: string) {
    const [company, employees, branches] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { state: true } }),
      this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { state: true } }),
      this.prisma.branch.findMany({ where: { companyId }, select: { state: true } }),
    ]);
    const set = new Set<string>();
    employees.forEach(e => e.state && set.add(e.state));
    branches.forEach(b => b.state && set.add(b.state));
    const states = Array.from(set).sort();
    return { companyState: company?.state || null, states };
  }

  // ── Gratuity Register ─────────────────────────────────────
  async gratuityRegister(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where:  { companyId, status: 'ACTIVE' },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        designation: true, dateOfJoining: true, ctc: true,
        salaryStructure: { select: { components: { select: { component: { select: { code: true, value: true, calculationType: true } } } } } },
      },
    });

    const now  = new Date();
    const rows = employees.map(emp => {
      const yrs       = (now.getTime() - emp.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000);
      const basic     = this.estimateBasic(emp);
      const eligible  = yrs >= GRATUITY_MIN_SERVICE_YEARS;
      const accrued   = Math.min(
        Math.round((GRATUITY_RATE_NUMERATOR / GRATUITY_RATE_DENOMINATOR) * basic * yrs),
        GRATUITY_MAX_AMOUNT,
      );
      return {
        employeeCode:    emp.employeeCode,
        name:            `${emp.firstName} ${emp.lastName}`,
        designation:     emp.designation,
        dateOfJoining:   emp.dateOfJoining,
        yearsOfService:  Math.round(yrs * 10) / 10,
        monthlyBasic:    Math.round(basic),
        accruedGratuity: accrued,
        eligible,
      };
    }).sort((a, b) => b.yearsOfService - a.yearsOfService);

    return { rows, totalAccrued: rows.reduce((s, r) => s + r.accruedGratuity, 0) };
  }

  // ── Bonus Register ────────────────────────────────────────
  async bonusRegister(companyId: string, financialYear: string) {
    const [fromYr] = financialYear.split('-').map(Number);
    const fromDate = new Date(fromYr, 3, 1);
    const toDate   = new Date(fromYr + 1, 2, 31);

    const employees = await this.prisma.employee.findMany({
      where:  { companyId, status: { in: ['ACTIVE', 'TERMINATED'] } },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        designation: true, dateOfJoining: true, ctc: true,
        salaryStructure: { select: { components: { select: { component: { select: { code: true, value: true, calculationType: true } } } } } },
      },
    });

    const rows = employees
      .filter(emp => emp.ctc / 12 <= BONUS_WAGE_CEILING)
      .map(emp => {
        const basic        = this.estimateBasic(emp);
        const serviceStart = emp.dateOfJoining > fromDate ? emp.dateOfJoining : fromDate;
        const months       = Math.max(0, Math.min(12, (toDate.getTime() - serviceStart.getTime()) / (30.44 * 24 * 3600 * 1000)));
        const calcBase     = Math.min(basic, BONUS_CALC_CAP);
        return {
          employeeCode:   emp.employeeCode,
          name:           `${emp.firstName} ${emp.lastName}`,
          designation:    emp.designation,
          dateOfJoining:  emp.dateOfJoining,
          monthlyBasic:   Math.round(basic),
          calcBase:       Math.round(calcBase),
          eligibleMonths: Math.round(months * 10) / 10,
          minBonus:       Math.round(calcBase * BONUS_MIN_RATE * months),
          maxBonus:       Math.round(calcBase * 0.20 * months),
        };
      });

    const totals = rows.reduce(
      (a, r) => ({ minBonus: a.minBonus + r.minBonus, maxBonus: a.maxBonus + r.maxBonus }),
      { minBonus: 0, maxBonus: 0 },
    );

    return { financialYear, rows, totals };
  }

  // ── Payroll engine compatibility methods ──────────────────
  // These are called by PayrollEngine during payslip calculation.
  getPFConfig(_companyId: string) {
    return Promise.resolve({
      wageLimit: PF_WAGE_CEILING,
      employeeContributionRate: PF_EMPLOYEE_RATE * 100,
      employerEPFRate: PF_EPF_EMPLOYER * 100,
      employerEPSRate: PF_EPS_EMPLOYER * 100,
    });
  }

  getESIConfig(_companyId: string) {
    return Promise.resolve({
      wageLimit: ESI_GROSS_CEILING,
      employeeContributionRate: ESI_EMPLOYEE_RATE * 100,
      employerContributionRate: ESI_EMPLOYER_RATE * 100,
    });
  }

  calculatePT(state: string, gross: number, isFeb = false) {
    return Promise.resolve(this.calcPT(state, gross, isFeb));
  }

  // Monthly TDS estimate for payroll engine — simplified projection
  async calculateMonthlyTDS(employeeId: string, annualCTC: number, month: number, year: number) {
    try {
      const fy = month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
      const decl = await this.prisma.tDSDeclaration.findUnique({
        where: { employeeId_financialYear: { employeeId, financialYear: fy } },
      });
      const regime = (decl?.regime || 'NEW') as 'OLD' | 'NEW';
      const gross  = annualCTC;
      const stdDed = regime === 'NEW' ? 75000 : 50000;
      const taxable = Math.max(0, gross - stdDed - (regime === 'OLD' ? Math.min((decl?.section80C ?? 0), 150000) : 0));
      const slabs   = regime === 'NEW'
        ? [300000, 600000, 900000, 1200000, 1500000].map((t, i) => ({ upTo: t, rate: [0, 5, 10, 15, 20][i] }))
        : [250000, 500000, 1000000].map((t, i) => ({ upTo: t, rate: [0, 5, 20][i] }));
      let tax = 0;
      let prev = 0;
      for (const s of slabs) {
        if (taxable <= prev) break;
        tax += Math.min(taxable - prev, s.upTo - prev) * (s.rate / 100);
        prev = s.upTo;
      }
      if (taxable > (regime === 'NEW' ? 1500000 : 1000000)) tax += (taxable - (regime === 'NEW' ? 1500000 : 1000000)) * 0.30;
      const cess  = tax * 0.04;
      const annual = Math.round(tax + cess);
      // Months remaining in FY from this month
      const fyMonthsLeft = month >= 4 ? (3 + (12 - month + 1)) : (3 - month + 1);
      return Math.max(0, Math.round(annual / Math.max(fyMonthsLeft, 1)));
    } catch {
      return 0;
    }
  }

  // ── Private helpers ───────────────────────────────────────
  private calcPT(state: string, gross: number, isFeb = false): number {
    const slabs = PT_SLABS[state];
    if (!slabs?.length) return 0;
    for (const slab of slabs) {
      if (gross <= slab.upTo) {
        let tax = slab.tax;
        // Maharashtra: only the top ₹200 slab attracts the extra ₹100 in February (→ ₹300).
        if (state === 'Maharashtra' && isFeb && tax === 200) tax += MAHARASHTRA_FEB_EXTRA;
        return tax;
      }
    }
    return 0;
  }

  private getComp(ps: any, code: string): number {
    return ps.lines?.find((l: any) => l.component?.code === code)?.amount ?? 0;
  }

  private estimateBasic(emp: any): number {
    const monthlyCtc = emp.ctc / 12;
    const comp = emp.salaryStructure?.components?.find((c: any) => c.component.code === 'BASIC')?.component;
    const pct  = comp?.calculationType === 'PERCENTAGE_OF_CTC' ? (comp.value as number) / 100 : 0.4;
    return monthlyCtc * pct;
  }

  private getPayslips(companyId: string, month: number, year: number) {
    return this.prisma.payslip.findMany({
      where: { payrun: { companyId, month, year, status: { in: ['APPROVED', 'PAID'] } } },
      include: {
        employee: {
          select: {
            id: true, employeeCode: true, firstName: true, lastName: true,
            pan: true, uan: true, esiNumber: true, state: true,
            branch: { select: { state: true } },
          },
        },
        lines: { include: { component: { select: { code: true } } } },
      },
    });
  }
}
