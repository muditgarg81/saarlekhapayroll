import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

// Prescribed SBI lending rate for perquisite valuation (interest-free / concessional loans, Rule 3(7)(i)).
const SBI_PERQ_RATE = 0.10;           // 10% p.a. — configurable per FY
const PERQ_EXEMPT_LIMIT = 20000;      // loans up to ₹20,000 are exempt

function round(n: number) { return Math.round(n * 100) / 100; }

@Injectable()
export class LoansService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // EMI via reducing-balance amortisation (flat if rate is 0).
  computeEmi(principal: number, annualRatePct: number, tenureMonths: number): number {
    if (tenureMonths <= 0) throw new BadRequestException('Tenure must be at least 1 month');
    if (annualRatePct <= 0) return Math.round(principal / tenureMonths);
    const r = annualRatePct / 100 / 12;
    const f = Math.pow(1 + r, tenureMonths);
    return Math.round((principal * r * f) / (f - 1));
  }

  private buildSchedule(principal: number, annualRatePct: number, tenureMonths: number, emi: number, startMonth: number, startYear: number) {
    const r = annualRatePct / 100 / 12;
    let outstanding = principal;
    let m = startMonth, y = startYear;
    const rows: any[] = [];
    for (let i = 1; i <= tenureMonths; i++) {
      const interest = annualRatePct > 0 ? round(outstanding * r) : 0;
      let principalPart = round(emi - interest);
      if (i === tenureMonths || principalPart > outstanding) principalPart = round(outstanding); // settle remainder
      const emiAmount = round(principalPart + interest);
      outstanding = round(outstanding - principalPart);
      rows.push({ installmentNo: i, month: m, year: y, emiAmount, principalPart, interestPart: interest, outstandingAfter: Math.max(0, outstanding), status: 'SCHEDULED' });
      m++; if (m > 12) { m = 1; y++; }
    }
    return rows;
  }

  async createLoan(companyId: string, actorId: string, dto: {
    employeeId: string; loanType?: string; principal: number; interestRate?: number; tenureMonths: number;
    startMonth: number; startYear: number; reason?: string;
  }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (dto.principal <= 0) throw new BadRequestException('Principal must be positive');

    const rate = dto.interestRate ?? 0;
    const emi = this.computeEmi(dto.principal, rate, dto.tenureMonths);
    const schedule = this.buildSchedule(dto.principal, rate, dto.tenureMonths, emi, dto.startMonth, dto.startYear);

    const loan = await this.prisma.loan.create({
      data: {
        companyId, employeeId: dto.employeeId, loanType: dto.loanType || 'PERSONAL',
        principal: dto.principal, interestRate: rate, tenureMonths: dto.tenureMonths, emi,
        startMonth: dto.startMonth, startYear: dto.startYear, outstanding: dto.principal,
        reason: dto.reason, disbursedAt: new Date(), createdBy: actorId,
        repayments: { create: schedule },
      },
      include: { repayments: { orderBy: { installmentNo: 'asc' } } },
    });
    await this.audit.log(actorId, companyId, 'CREATE', 'Loan', loan.id, `Loan ₹${dto.principal} (${loan.loanType}) for ${emp.firstName} ${emp.lastName}, EMI ₹${emi}×${dto.tenureMonths}`);
    return loan;
  }

  async listLoans(companyId: string, status?: string) {
    const loans = await this.prisma.loan.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, _count: { select: { repayments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return loans.map(l => ({
      ...l,
      paidCount: 0, // filled by detail; list keeps it light
      totalPayable: Math.round(l.emi * l.tenureMonths),
    }));
  }

  async getLoan(id: string, companyId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id, companyId },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, repayments: { orderBy: { installmentNo: 'asc' } } },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    const paid = loan.repayments.filter(r => r.status === 'PAID');
    const totalInterest = loan.repayments.reduce((s, r) => s + r.interestPart, 0);
    return {
      ...loan,
      summary: {
        totalPayable: Math.round(loan.emi * loan.tenureMonths),
        totalInterest: Math.round(totalInterest),
        paidInstallments: paid.length,
        paidAmount: Math.round(paid.reduce((s, r) => s + r.emiAmount, 0)),
        remainingInstallments: loan.tenureMonths - paid.length,
      },
    };
  }

  /** Mark an installment paid (e.g. deducted in a payrun). Updates outstanding + closes when done. */
  async postInstallment(id: string, companyId: string, actorId: string, installmentNo: number, payslipId?: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id, companyId }, include: { repayments: true } });
    if (!loan) throw new NotFoundException('Loan not found');
    const rep = loan.repayments.find(r => r.installmentNo === installmentNo);
    if (!rep) throw new NotFoundException('Installment not found');
    if (rep.status === 'PAID') throw new BadRequestException('Installment already paid');

    await this.prisma.loanRepayment.update({ where: { id: rep.id }, data: { status: 'PAID', paidAt: new Date(), payslipId } });
    const allPaid = loan.repayments.filter(r => r.id !== rep.id).every(r => r.status === 'PAID') && true;
    await this.prisma.loan.update({
      where: { id },
      data: { outstanding: rep.outstandingAfter, ...(rep.outstandingAfter <= 0 || allPaid ? { status: 'CLOSED', closedAt: new Date() } : {}) },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Loan', id, `Installment #${installmentNo} posted (₹${rep.emiAmount}); outstanding ₹${rep.outstandingAfter}`);
    return { success: true, outstanding: rep.outstandingAfter };
  }

  async cancelLoan(id: string, companyId: string, actorId: string) {
    const loan = await this.prisma.loan.findFirst({ where: { id, companyId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status === 'CLOSED') throw new BadRequestException('Closed loans cannot be cancelled');
    await this.prisma.loan.update({ where: { id }, data: { status: 'CANCELLED', closedAt: new Date() } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Loan', id, 'Loan cancelled');
    return { success: true };
  }

  // ── Loan Calculating Summary (active loans + outstanding) ──
  async loanSummary(companyId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { companyId },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, repayments: { select: { status: true, emiAmount: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    const rows = loans.map(l => {
      const paid = l.repayments.filter(r => r.status === 'PAID');
      return {
        id: l.id, employeeCode: l.employee.employeeCode, name: `${l.employee.firstName} ${l.employee.lastName}`,
        loanType: l.loanType, principal: Math.round(l.principal), interestRate: l.interestRate, emi: Math.round(l.emi),
        tenureMonths: l.tenureMonths, paidInstallments: paid.length, outstanding: Math.round(l.outstanding), status: l.status,
      };
    });
    const totals = rows.reduce((t, r) => ({
      principal: t.principal + r.principal, outstanding: t.outstanding + (r.status === 'ACTIVE' ? r.outstanding : 0),
    }), { principal: 0, outstanding: 0 });
    return { rows, totals, activeCount: rows.filter(r => r.status === 'ACTIVE').length };
  }

  // ── Loan Perquisite Summary (Rule 3(7)(i)) ─────────────────
  /** Taxable perquisite = (SBI rate − rate charged) on the monthly outstanding balance. */
  async perquisiteSummary(companyId: string, financialYear: string, projected = false) {
    const [fromYr] = financialYear.split('-').map(Number);
    const loans = await this.prisma.loan.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CLOSED'] } },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, repayments: { orderBy: { installmentNo: 'asc' } } },
    });

    const now = new Date();
    const inFy = (m: number, y: number) => (y === fromYr && m >= 4) || (y === fromYr + 1 && m <= 3);
    const isPast = (m: number, y: number) => new Date(y, m - 1, 1) <= now;

    const rows = loans.map(loan => {
      const diffRate = Math.max(0, SBI_PERQ_RATE - loan.interestRate / 100);
      const exempt = loan.principal <= PERQ_EXEMPT_LIMIT || diffRate === 0;
      let perquisite = 0;
      let monthsCounted = 0;
      // opening balance for the FY = principal less principal already repaid before April
      for (const r of loan.repayments) {
        if (!inFy(r.month, r.year)) continue;
        if (!projected && !isPast(r.month, r.year)) continue; // realised-only unless projecting
        // outstanding during the month ≈ balance before this instalment is the prior outstandingAfter; use outstandingAfter as month-end balance
        const monthlyPerq = exempt ? 0 : round(r.outstandingAfter * diffRate / 12);
        perquisite += monthlyPerq;
        monthsCounted++;
      }
      return {
        loanId: loan.id, employeeCode: loan.employee.employeeCode, name: `${loan.employee.firstName} ${loan.employee.lastName}`,
        loanType: loan.loanType, principal: Math.round(loan.principal), rateCharged: loan.interestRate, sbiRate: SBI_PERQ_RATE * 100,
        exempt, monthsCounted, perquisite: Math.round(perquisite),
      };
    }).filter(r => r.perquisite > 0 || (!r.exempt && r.monthsCounted > 0));

    return {
      financialYear, projected, sbiRate: SBI_PERQ_RATE * 100, exemptLimit: PERQ_EXEMPT_LIMIT,
      rows, totalPerquisite: rows.reduce((s, r) => s + r.perquisite, 0),
    };
  }
}
