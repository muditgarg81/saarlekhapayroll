import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OLD_REGIME_SLABS, NEW_REGIME_SLABS } from '@saarlekha/shared';
import { AuditService } from '../audit/audit.service';

// ─── Constants ────────────────────────────────────────────────
const STANDARD_DEDUCTION_OLD = 50000;
const STANDARD_DEDUCTION_NEW = 75000; // FY 2024-25 onwards
const SEC_80C_LIMIT          = 150000;
const SEC_80D_LIMIT_SELF     = 25000;
const SEC_80D_LIMIT_SENIOR   = 50000;
const SEC_24B_LIMIT          = 200000;
const NPS_80CCD1B_LIMIT      = 50000;
const REBATE_87A_OLD_LIMIT   = 500000;   // income limit for zero tax
const REBATE_87A_OLD_MAX     = 12500;
const REBATE_87A_NEW_LIMIT   = 700000;
const REBATE_87A_NEW_MAX     = 25000;

// Surcharge on tax
function surchargeRate(taxableIncome: number): number {
  if (taxableIncome > 50000000) return 0.37;
  if (taxableIncome > 20000000) return 0.25;
  if (taxableIncome > 10000000) return 0.15;
  if (taxableIncome > 5000000)  return 0.10;
  return 0;
}

// Quarter from month (1-based)
function quarter(month: number): number {
  // Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  if (month >= 4 && month <= 6)  return 1;
  if (month >= 7 && month <= 9)  return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4; // Jan-Mar
}

// FY string → { fromYear, toYear }
function parseFY(fy: string) {
  const [fromYr] = fy.split('-').map(Number);
  return { fromYr, toYr: fromYr + 1 };
}

// Months that belong to the FY (April yr → March yr+1) as { month, year }
function fyMonths(fy: string) {
  const { fromYr, toYr } = parseFY(fy);
  return [
    ...([4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => ({ month: m, year: fromYr }))),
    ...([1, 2, 3].map(m => ({ month: m, year: toYr }))),
  ];
}

@Injectable()
export class TDSService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Form 12BB: save declaration ───────────────────────────
  async saveDeclaration(employeeId: string, companyId: string, actorId: string, dto: any) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const decl = await this.prisma.tDSDeclaration.upsert({
      where:  { employeeId_financialYear: { employeeId, financialYear: dto.financialYear } },
      update: { ...dto, submittedAt: new Date(), isApproved: false, approvedBy: null, approvedAt: null },
      create: { employeeId, ...dto },
    });

    await this.audit.log(actorId, companyId, 'UPDATE', 'TDSDeclaration', decl.id, `Form 12BB updated for ${employee.firstName} ${employee.lastName}`);
    return decl;
  }

  // ── Form 12BB: approve declaration ───────────────────────
  async approveDeclaration(declId: string, companyId: string, actorId: string) {
    const decl = await this.prisma.tDSDeclaration.findUnique({ where: { id: declId }, include: { employee: true } });
    if (!decl || decl.employee.companyId !== companyId) throw new NotFoundException('Declaration not found');
    const updated = await this.prisma.tDSDeclaration.update({
      where: { id: declId },
      data:  { isApproved: true, approvedBy: actorId, approvedAt: new Date() },
    });
    await this.audit.log(actorId, companyId, 'APPROVE', 'TDSDeclaration', declId, 'Form 12BB approved');
    return updated;
  }

  // ── Get declaration for employee ──────────────────────────
  async getDeclaration(employeeId: string, companyId: string, financialYear: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.tDSDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } },
    });
  }

  // ── List declarations (admin) ─────────────────────────────
  async listDeclarations(companyId: string, financialYear: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true, tdsDeclarations: { where: { financialYear } } },
    });
    return employees.map(e => ({
      employeeId:   e.id,
      employeeCode: e.employeeCode,
      name:         `${e.firstName} ${e.lastName}`,
      designation:  e.designation,
      declaration:  e.tdsDeclarations[0] || null,
    }));
  }

  // ── TDS Computation Engine ────────────────────────────────
  async computeTDS(employeeId: string, companyId: string, financialYear: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const decl = await this.prisma.tDSDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear } },
    });

    // Collect actual payslips in the FY
    const months = fyMonths(financialYear);
    const payslips = await this.prisma.payslip.findMany({
      where: {
        employeeId,
        OR: months.map(m => ({ month: m.month, year: m.year })),
        payrun: { status: { in: ['APPROVED', 'PAID'] } },
      },
      include: { lines: { include: { component: { select: { code: true } } } } },
    });

    // Gross salary from payslips; fall back to annualised CTC
    const actualGross = payslips.reduce((s, p) => s + p.grossEarnings, 0);
    const monthsCompleted = payslips.length;
    const remainingMonths = Math.max(0, 12 - monthsCompleted);
    // Estimate remaining from ctc
    const projectedGross = actualGross + (employee.ctc / 12) * remainingMonths;
    const annualGross    = Math.round(projectedGross);

    // PT paid (sum from payslips)
    const ptPaid = payslips.reduce((s, p) => {
      const ptLine = p.lines.find((l: any) => l.component?.code === 'PT');
      return s + (ptLine?.amount ?? 0);
    }, 0);

    // PF employee contribution (for 80C)
    const pfPaid = payslips.reduce((s, p) => {
      const pfLine = p.lines.find((l: any) => l.component?.code === 'PF_EMPLOYEE');
      return s + (pfLine?.amount ?? 0);
    }, 0);
    const projectedPF = pfPaid + (pfPaid / (monthsCompleted || 1)) * remainingMonths;

    const regime = (decl?.regime || 'NEW') as 'OLD' | 'NEW';

    // ── Old Regime Computation ───────────────────────────────
    const oldResult = this.computeOldRegime(annualGross, ptPaid, projectedPF, decl);

    // ── New Regime Computation ───────────────────────────────
    const newResult = this.computeNewRegime(annualGross, decl);

    // Monthly TDS to deduct (current month onward)
    const chosenResult = regime === 'OLD' ? oldResult : newResult;
    const tdsAlreadyDeducted = payslips.reduce((s, p) => {
      const tdsLine = p.lines.find((l: any) => l.component?.code === 'TDS');
      return s + (tdsLine?.amount ?? 0);
    }, 0);
    const balanceTDS       = Math.max(0, chosenResult.totalTaxLiability - tdsAlreadyDeducted);
    const monthlyTDS       = remainingMonths > 0 ? Math.round(balanceTDS / remainingMonths) : 0;

    return {
      financialYear,
      employeeId,
      employeeName:  `${employee.firstName} ${employee.lastName}`,
      employeeCode:  employee.employeeCode,
      pan:           employee.pan,
      regime,
      annualGross,
      monthsCompleted,
      remainingMonths,
      tdsAlreadyDeducted:  Math.round(tdsAlreadyDeducted),
      monthlyTDS,
      oldRegime:     oldResult,
      newRegime:     newResult,
      chosenRegime:  chosenResult,
      recommendation: newResult.totalTaxLiability < oldResult.totalTaxLiability ? 'NEW' : 'OLD',
    };
  }

  // ── 24Q Quarterly Return ──────────────────────────────────
  async compute24Q(companyId: string, financialYear: string, qtr: number) {
    if (qtr < 1 || qtr > 4) throw new BadRequestException('Quarter must be 1-4');

    // Months in the quarter within this FY
    const qMonths: Record<number, { month: number; year: number }[]> = {
      1: [4, 5, 6].map(m => ({ month: m, year: parseFY(financialYear).fromYr })),
      2: [7, 8, 9].map(m => ({ month: m, year: parseFY(financialYear).fromYr })),
      3: [10, 11, 12].map(m => ({ month: m, year: parseFY(financialYear).fromYr })),
      4: [1, 2, 3].map(m => ({ month: m, year: parseFY(financialYear).toYr })),
    };

    const months = qMonths[qtr];
    const payslips = await this.prisma.payslip.findMany({
      where: {
        payrun: { companyId, status: { in: ['APPROVED', 'PAID'] } },
        OR: months.map(m => ({ month: m.month, year: m.year })),
      },
      include: {
        employee: { select: { employeeCode: true, firstName: true, lastName: true, pan: true } },
        lines: { include: { component: { select: { code: true } } } },
      },
    });

    // Group by employee
    const byEmployee: Record<string, any> = {};
    for (const ps of payslips) {
      const key = ps.employeeId;
      if (!byEmployee[key]) {
        byEmployee[key] = {
          employeeCode: ps.employee.employeeCode,
          name: `${ps.employee.firstName} ${ps.employee.lastName}`,
          pan:  ps.employee.pan || 'PANNOTAVBL',
          salaryPaid: 0, tdsDeducted: 0,
        };
      }
      byEmployee[key].salaryPaid  += ps.grossEarnings;
      byEmployee[key].tdsDeducted += ps.lines.find((l: any) => l.component?.code === 'TDS')?.amount ?? 0;
    }

    const deductees = Object.values(byEmployee).map((d: any) => ({
      ...d,
      salaryPaid:   Math.round(d.salaryPaid),
      tdsDeducted:  Math.round(d.tdsDeducted),
    }));

    const totals = deductees.reduce(
      (a, d) => ({ salary: a.salary + d.salaryPaid, tds: a.tds + d.tdsDeducted }),
      { salary: 0, tds: 0 },
    );

    // Upsert into DB
    const ret = await this.prisma.tDSReturn24Q.upsert({
      where:  { companyId_financialYear_quarter: { companyId, financialYear, quarter: qtr } },
      update: { totalSalary: totals.salary, totalTDS: totals.tds, employeeCount: deductees.length, data: deductees },
      create: { companyId, financialYear, quarter: qtr, totalSalary: totals.salary, totalTDS: totals.tds, employeeCount: deductees.length, data: deductees },
    });

    return { ...ret, deductees, totals };
  }

  async list24Q(companyId: string, financialYear: string) {
    return this.prisma.tDSReturn24Q.findMany({ where: { companyId, financialYear }, orderBy: { quarter: 'asc' } });
  }

  async mark24QFiled(companyId: string, financialYear: string, qtr: number, actorId: string) {
    const ret = await this.prisma.tDSReturn24Q.update({
      where:  { companyId_financialYear_quarter: { companyId, financialYear, quarter: qtr } },
      data:   { status: 'FILED', filedAt: new Date() },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'TDSReturn24Q', ret.id, `24Q Q${qtr} FY${financialYear} marked as filed`);
    return ret;
  }

  // ── Form 16 Generation ────────────────────────────────────
  async generateForm16(employeeId: string, companyId: string, financialYear: string, actorId: string) {
    const computed = await this.computeTDS(employeeId, companyId, financialYear);
    const chosen   = computed.chosenRegime;

    const form16 = await this.prisma.form16.upsert({
      where:  { employeeId_financialYear: { employeeId, financialYear } },
      update: {
        grossSalary:       computed.annualGross,
        standardDeduction: chosen.standardDeduction,
        totalDeductions:   chosen.totalDeductions,
        taxableIncome:     chosen.taxableIncome,
        grossTax:          chosen.grossTax,
        surcharge:         chosen.surcharge,
        cess:              chosen.cess,
        totalTaxLiability: chosen.totalTaxLiability,
        totalTDSDeducted:  computed.tdsAlreadyDeducted,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
      create: {
        employeeId, companyId, financialYear,
        grossSalary:       computed.annualGross,
        standardDeduction: chosen.standardDeduction,
        totalDeductions:   chosen.totalDeductions,
        taxableIncome:     chosen.taxableIncome,
        grossTax:          chosen.grossTax,
        surcharge:         chosen.surcharge,
        cess:              chosen.cess,
        totalTaxLiability: chosen.totalTaxLiability,
        totalTDSDeducted:  computed.tdsAlreadyDeducted,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    await this.audit.log(actorId, companyId, 'CREATE', 'Form16', form16.id, `Form 16 issued to ${computed.employeeName} FY${financialYear}`);
    return { ...form16, computation: computed };
  }

  async listForm16(companyId: string, financialYear: string) {
    return this.prisma.form16.findMany({
      where:   { companyId, financialYear },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true, pan: true, designation: true } } },
      orderBy: { employee: { firstName: 'asc' } },
    });
  }

  async getForm16(id: string, companyId: string) {
    const f = await this.prisma.form16.findFirst({
      where:   { id, companyId },
      include: { employee: { include: { company: true } } },
    });
    if (!f) throw new NotFoundException('Form 16 not found');
    return f;
  }

  async markEsigned(id: string, companyId: string, actorId: string) {
    const f = await this.prisma.form16.update({
      where: { id },
      data:  { status: 'ESIGNED', eSignedAt: new Date() },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Form16', id, 'Form 16 eSigned');
    return f;
  }

  // ── Tax computation helpers ───────────────────────────────
  private computeOldRegime(gross: number, ptPaid: number, pfPaid: number, decl: any) {
    const stdDed  = STANDARD_DEDUCTION_OLD;
    // 80C: PF + declared investments, capped at ₹1.5L
    const sec80C  = Math.min((decl?.section80C ?? 0) + pfPaid, SEC_80C_LIMIT);
    const sec80D  = Math.min(decl?.section80D ?? 0, SEC_80D_LIMIT_SELF);
    const sec80G  = decl?.section80G ?? 0;
    const sec80E  = decl?.section80E ?? 0;
    const sec80EE = decl?.section80EE ?? 0;
    const nps     = Math.min(decl?.npsContrib80CCD1B ?? 0, NPS_80CCD1B_LIMIT);
    const hra     = decl?.hraExemption ?? 0;
    const lta     = decl?.ltaExemption ?? 0;
    const sec24b  = Math.min(decl?.homeLoanInterest ?? 0, SEC_24B_LIMIT);
    const other   = decl?.otherDeductions ?? 0;

    const totalDeductions = stdDed + sec80C + sec80D + sec80G + sec80E + sec80EE + nps + hra + lta + sec24b + other + ptPaid;
    const taxableIncome   = Math.max(0, gross - totalDeductions);
    const grossTax        = this.applySlabs(taxableIncome, OLD_REGIME_SLABS);
    const rebate          = taxableIncome <= REBATE_87A_OLD_LIMIT ? Math.min(grossTax, REBATE_87A_OLD_MAX) : 0;
    const taxAfterRebate  = Math.max(0, grossTax - rebate);
    const surcharge       = Math.round(taxAfterRebate * surchargeRate(taxableIncome));
    const cess            = Math.round((taxAfterRebate + surcharge) * 0.04);
    const totalTaxLiability = taxAfterRebate + surcharge + cess;

    return { standardDeduction: stdDed, deductionBreakdown: { sec80C, sec80D, sec80G, sec80E, sec80EE, nps, hra, lta, sec24b, ptPaid, other }, totalDeductions: Math.round(totalDeductions), taxableIncome: Math.round(taxableIncome), grossTax: Math.round(grossTax), rebate: Math.round(rebate), surcharge, cess, totalTaxLiability: Math.round(totalTaxLiability) };
  }

  private computeNewRegime(gross: number, decl: any) {
    const stdDed  = STANDARD_DEDUCTION_NEW;
    // New regime: only standard deduction + employer NPS 80CCD(2) allowed
    // (No 80C, no HRA, no LTA, no 24b under new regime)
    const totalDeductions = stdDed;
    const taxableIncome   = Math.max(0, gross - totalDeductions);
    const grossTax        = this.applySlabs(taxableIncome, NEW_REGIME_SLABS);
    const rebate          = taxableIncome <= REBATE_87A_NEW_LIMIT ? Math.min(grossTax, REBATE_87A_NEW_MAX) : 0;
    const taxAfterRebate  = Math.max(0, grossTax - rebate);
    const surcharge       = Math.round(taxAfterRebate * surchargeRate(taxableIncome));
    const cess            = Math.round((taxAfterRebate + surcharge) * 0.04);
    const totalTaxLiability = taxAfterRebate + surcharge + cess;

    return { standardDeduction: stdDed, deductionBreakdown: { stdDed }, totalDeductions: Math.round(totalDeductions), taxableIncome: Math.round(taxableIncome), grossTax: Math.round(grossTax), rebate: Math.round(rebate), surcharge, cess, totalTaxLiability: Math.round(totalTaxLiability) };
  }

  private applySlabs(income: number, slabs: typeof OLD_REGIME_SLABS): number {
    let tax = 0;
    for (const slab of slabs) {
      if (income <= 0) break;
      const min = slab.minIncome;
      const max = slab.maxIncome ?? Infinity;
      if (income < min) break;
      const taxable = Math.min(income, max) - min + 1;
      tax += taxable * (slab.rate / 100);
    }
    return Math.round(tax);
  }
}
