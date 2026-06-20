import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PayrollEngine } from './payroll-engine.service';
import { AuditService } from '../audit/audit.service';

const CANCELLABLE = ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL'];

@Injectable()
export class PayrunService {
  constructor(
    private prisma: PrismaService,
    private engine: PayrollEngine,
    private audit: AuditService,
  ) {}

  // ── Create ────────────────────────────────────────────────
  async create(companyId: string, userId: string, dto: {
    month: number; year: number; type?: string;
    employeeIds?: string[]; payDate?: string; notes?: string;
  }) {
    const type = dto.type || 'REGULAR';
    if (type === 'REGULAR') {
      const dup = await this.prisma.payrun.findFirst({
        where: { companyId, month: dto.month, year: dto.year, type, status: { not: 'CANCELLED' } },
      });
      if (dup) throw new BadRequestException('A regular payrun already exists for this period');
    }

    const payrun = await this.prisma.payrun.create({
      data: {
        companyId, month: dto.month, year: dto.year, type, status: 'DRAFT',
        createdBy: userId, notes: dto.notes,
        payDate: dto.payDate ? new Date(dto.payDate) : undefined,
        employeeIds: dto.employeeIds ?? null,
      },
    });

    await this.audit.log(userId, companyId, 'CREATE', 'Payrun', payrun.id,
      `${type} payrun created for ${dto.month}/${dto.year}`);
    return payrun;
  }

  // ── Preview (dry-run, no DB writes) ──────────────────────
  async preview(payrunId: string, companyId: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    const employees = await this.getEmployees(payrun);
    const workingDays = this.getWorkingDays(payrun.month, payrun.year);

    const rows = await Promise.all(employees.map(async emp => {
      const lopDays = await this.getLOPDays(emp.id, payrun.month, payrun.year, workingDays);
      const calc = await this.engine.calculatePayslip(emp.id, payrun.month, payrun.year, workingDays, lopDays);
      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation,
        workingDays,
        paidDays: calc.paidDays,
        lopDays,
        grossEarnings: calc.grossEarnings,
        totalDeductions: calc.totalDeductions,
        netPay: calc.netPay,
        earnings: calc.earnings,
        deductions: calc.deductions,
      };
    }));

    return {
      payrunId,
      month: payrun.month,
      year: payrun.year,
      type: payrun.type,
      totalEmployees: rows.length,
      totalGross: rows.reduce((s, r) => s + r.grossEarnings, 0),
      totalDeductions: rows.reduce((s, r) => s + r.totalDeductions, 0),
      totalNetPay: rows.reduce((s, r) => s + r.netPay, 0),
      rows,
    };
  }

  // ── Process ───────────────────────────────────────────────
  async process(payrunId: string, companyId: string, userId: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (payrun.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT payruns can be processed');

    const employees = await this.getEmployees(payrun);
    const workingDays = this.getWorkingDays(payrun.month, payrun.year);
    let totalGross = 0, totalDed = 0, totalNet = 0;

    for (const emp of employees) {
      const lopDays = await this.getLOPDays(emp.id, payrun.month, payrun.year, workingDays);
      const calc = await this.engine.calculatePayslip(emp.id, payrun.month, payrun.year, workingDays, lopDays);

      // Apply any pre-saved overrides
      const existing = await this.prisma.payslip.findUnique({
        where: { payrunId_employeeId: { payrunId, employeeId: emp.id } },
      });
      const overrides: Record<string, number> = (existing?.overrideComponents as any) || {};

      const earnings = calc.earnings.map(e => ({
        ...e, amount: overrides[e.componentCode] ?? e.amount,
      }));
      const deductions = calc.deductions.map(d => ({
        ...d, amount: overrides[d.componentCode] ?? d.amount,
      }));
      const gross = earnings.reduce((s, e) => s + e.amount, 0);
      const ded   = deductions.reduce((s, d) => s + d.amount, 0);
      const net   = Math.max(gross - ded, 0);

      await this.prisma.payslip.upsert({
        where: { payrunId_employeeId: { payrunId, employeeId: emp.id } },
        create: {
          payrunId, employeeId: emp.id, month: payrun.month, year: payrun.year,
          workingDays, paidDays: calc.paidDays, lopDays: calc.lopDays,
          grossEarnings: gross, totalDeductions: ded, netPay: net, status: 'DRAFT',
          lines: { create: [
            ...earnings.map(e => ({ componentId: e.componentId, type: 'EARNING', amount: e.amount })),
            ...deductions.map(d => ({ componentId: d.componentId, type: 'DEDUCTION', amount: d.amount })),
          ]},
        },
        update: {
          workingDays, paidDays: calc.paidDays, lopDays: calc.lopDays,
          grossEarnings: gross, totalDeductions: ded, netPay: net,
          lines: { deleteMany: {}, create: [
            ...earnings.map(e => ({ componentId: e.componentId, type: 'EARNING', amount: e.amount })),
            ...deductions.map(d => ({ componentId: d.componentId, type: 'DEDUCTION', amount: d.amount })),
          ]},
        },
      });

      totalGross += gross; totalDed += ded; totalNet += net;
    }

    const updated = await this.prisma.payrun.update({
      where: { id: payrunId },
      data: {
        status: 'PENDING_REVIEW', totalEmployees: employees.length,
        totalGross, totalDeductions: totalDed, totalNetPay: totalNet,
      },
    });

    await this.audit.log(userId, companyId, 'UPDATE', 'Payrun', payrunId,
      `Payrun processed — ${employees.length} payslips generated`);
    return { payrun: updated, payslipsGenerated: employees.length };
  }

  // ── Review (HR_MANAGER) ───────────────────────────────────
  async review(payrunId: string, companyId: string, reviewerId: string, notes?: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (payrun.status !== 'PENDING_REVIEW')
      throw new BadRequestException('Payrun is not pending review');

    const updated = await this.prisma.payrun.update({
      where: { id: payrunId },
      data: {
        status: 'PENDING_APPROVAL',
        reviewedBy: reviewerId, reviewedAt: new Date(),
        notes: notes || payrun.notes,
      },
    });
    await this.audit.log(reviewerId, companyId, 'APPROVE', 'Payrun', payrunId, 'Payrun reviewed — sent for approval');
    return updated;
  }

  // ── Approve (ADMIN, maker-checker) ────────────────────────
  async approve(payrunId: string, companyId: string, approverId: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (payrun.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('Payrun is not pending approval');
    if (payrun.createdBy === approverId)
      throw new ForbiddenException('Maker-checker: the creator cannot approve their own payrun');

    const updated = await this.prisma.payrun.update({
      where: { id: payrunId },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() },
    });
    await this.prisma.payslip.updateMany({ where: { payrunId }, data: { status: 'FINALIZED' } });
    await this.audit.log(approverId, companyId, 'APPROVE', 'Payrun', payrunId, 'Payrun approved');
    return updated;
  }

  // ── Mark Paid ─────────────────────────────────────────────
  async markPaid(payrunId: string, companyId: string, userId: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (payrun.status !== 'APPROVED')
      throw new BadRequestException('Payrun must be approved before marking paid');

    const updated = await this.prisma.payrun.update({ where: { id: payrunId }, data: { status: 'PAID' } });
    await this.audit.log(userId, companyId, 'UPDATE', 'Payrun', payrunId, 'Payrun marked PAID');
    return updated;
  }

  // ── Cancel ────────────────────────────────────────────────
  async cancel(payrunId: string, companyId: string, userId: string, reason?: string) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (!CANCELLABLE.includes(payrun.status))
      throw new BadRequestException(`Cannot cancel a payrun with status ${payrun.status}`);

    const updated = await this.prisma.payrun.update({
      where: { id: payrunId },
      data: { status: 'CANCELLED', notes: reason ? `Cancelled: ${reason}` : payrun.notes },
    });
    await this.audit.log(userId, companyId, 'DELETE', 'Payrun', payrunId,
      `Payrun cancelled${reason ? ': ' + reason : ''}`);
    return updated;
  }

  // ── Override individual payslip components ────────────────
  async overridePayslip(
    payrunId: string, payslipId: string, companyId: string, userId: string,
    dto: { overrides: Record<string, number>; note?: string },
  ) {
    const payrun = await this.findPayrun(payrunId, companyId);
    if (!['PENDING_REVIEW', 'PENDING_APPROVAL'].includes(payrun.status))
      throw new BadRequestException('Overrides can only be applied while the payrun is under review');

    const payslip = await this.prisma.payslip.findUnique({ where: { id: payslipId } });
    if (!payslip || payslip.payrunId !== payrunId) throw new NotFoundException('Payslip not found');

    const existing: Record<string, number> = (payslip.overrideComponents as any) || {};
    const merged = { ...existing, ...dto.overrides };

    // Recompute totals
    const lines = await this.prisma.payslipLine.findMany({ where: { payslipId }, include: { component: true } });
    let gross = 0, ded = 0;
    for (const line of lines) {
      const amt = merged[line.component.code] !== undefined ? merged[line.component.code] : line.amount;
      if (line.type === 'EARNING') gross += amt; else ded += amt;
      if (merged[line.component.code] !== undefined) {
        await this.prisma.payslipLine.update({ where: { id: line.id }, data: { amount: merged[line.component.code] } });
      }
    }

    const updated = await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        overrideComponents: merged, overrideNote: dto.note,
        grossEarnings: gross, totalDeductions: ded, netPay: Math.max(gross - ded, 0),
      },
    });

    // Keep payrun totals in sync
    const allSlips = await this.prisma.payslip.findMany({ where: { payrunId } });
    await this.prisma.payrun.update({
      where: { id: payrunId },
      data: {
        totalGross: allSlips.reduce((s, sl) => s + sl.grossEarnings, 0),
        totalDeductions: allSlips.reduce((s, sl) => s + sl.totalDeductions, 0),
        totalNetPay: allSlips.reduce((s, sl) => s + sl.netPay, 0),
      },
    });

    await this.audit.log(userId, companyId, 'UPDATE', 'Payslip', payslipId,
      `Override: ${JSON.stringify(dto.overrides)}`);
    return updated;
  }

  // ── Full & Final Settlement ───────────────────────────────
  async createFnF(companyId: string, userId: string, dto: {
    employeeId: string; lastWorkingDay: string;
    encashLeaves?: number; notes?: string;
  }) {
    const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!emp || emp.companyId !== companyId) throw new NotFoundException('Employee not found');
    if (emp.status === 'TERMINATED') throw new BadRequestException('Employee is already terminated');

    const lwd = new Date(dto.lastWorkingDay);
    const month = lwd.getMonth() + 1;
    const year = lwd.getFullYear();
    const workingDaysTillLWD = this.getWorkingDaysTill(year, lwd.getMonth(), lwd.getDate());

    const calc = await this.engine.calculatePayslip(emp.id, month, year, workingDaysTillLWD, 0);

    // Gratuity (≥5 years: 15/26 × basic+DA × years)
    const yrs = (lwd.getTime() - new Date(emp.dateOfJoining).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    let gratuityAmount = 0;
    if (yrs >= 5) {
      const basicAndDA = (calc.earnings.find(e => e.componentCode === 'BASIC')?.amount || 0)
                       + (calc.earnings.find(e => e.componentCode === 'DA')?.amount || 0);
      gratuityAmount = Math.round((15 / 26) * basicAndDA * yrs);
    }

    // Leave encashment
    const basicMonthly = calc.earnings.find(e => e.componentCode === 'BASIC')?.amount || 0;
    const leaveEncashment = dto.encashLeaves ? Math.round(dto.encashLeaves * (basicMonthly / 26)) : 0;

    const totalGross = calc.grossEarnings + gratuityAmount + leaveEncashment;
    const netPay = calc.netPay + gratuityAmount + leaveEncashment;

    const payrun = await this.prisma.payrun.create({
      data: {
        companyId, month, year, type: 'FULL_FINAL', status: 'PENDING_REVIEW',
        createdBy: userId, notes: dto.notes, payDate: lwd,
        employeeIds: [dto.employeeId],
        totalEmployees: 1, totalGross, totalDeductions: calc.totalDeductions, totalNetPay: netPay,
      },
    });

    await this.prisma.payslip.create({
      data: {
        payrunId: payrun.id, employeeId: emp.id, month, year,
        workingDays: this.getWorkingDays(month, year),
        paidDays: workingDaysTillLWD, lopDays: 0,
        grossEarnings: totalGross, totalDeductions: calc.totalDeductions, netPay,
        status: 'DRAFT', gratuityAmount, leaveEncashment,
        lines: { create: [
          ...calc.earnings.map(e => ({ componentId: e.componentId, type: 'EARNING', amount: e.amount })),
          ...calc.deductions.map(d => ({ componentId: d.componentId, type: 'DEDUCTION', amount: d.amount })),
        ]},
      },
    });

    await this.prisma.employee.update({
      where: { id: dto.employeeId },
      data: { status: 'TERMINATED', dateOfLeaving: lwd },
    });

    await this.audit.log(userId, companyId, 'CREATE', 'Payrun', payrun.id,
      `FnF created for ${emp.firstName} ${emp.lastName}, LWD ${dto.lastWorkingDay}`);

    return {
      payrun,
      summary: {
        proRatedSalary: calc.grossEarnings,
        gratuityAmount,
        leaveEncashment,
        yearsOfService: Math.round(yrs * 10) / 10,
        totalSettlement: netPay,
      },
    };
  }

  // ── Queries ───────────────────────────────────────────────
  async findAll(companyId: string, filters?: { year?: number; month?: number; type?: string }) {
    return this.prisma.payrun.findMany({
      where: { companyId, ...filters },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const payrun = await this.prisma.payrun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true, department: true } },
            lines: { include: { component: true }, orderBy: { type: 'asc' } },
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });
    if (!payrun || payrun.companyId !== companyId) throw new NotFoundException('Payrun not found');
    return payrun;
  }

  // ── Private helpers ───────────────────────────────────────
  private async findPayrun(id: string, companyId: string) {
    const p = await this.prisma.payrun.findUnique({ where: { id } });
    if (!p || p.companyId !== companyId) throw new NotFoundException('Payrun not found');
    return p;
  }

  private async getEmployees(payrun: any) {
    const ids: string[] = Array.isArray(payrun.employeeIds) ? payrun.employeeIds : [];
    return this.prisma.employee.findMany({
      where: {
        companyId: payrun.companyId,
        status: 'ACTIVE',
        ...(ids.length ? { id: { in: ids } } : {}),
      },
    });
  }

  private getWorkingDays(month: number, year: number): number {
    const days = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= days; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  private getWorkingDaysTill(year: number, monthIndex: number, day: number): number {
    let count = 0;
    for (let d = 1; d <= day; d++) {
      const dow = new Date(year, monthIndex, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  private async getLOPDays(employeeId: string, month: number, year: number, workingDays: number): Promise<number> {
    const absences = await this.prisma.attendance.count({
      where: {
        employeeId, status: 'ABSENT',
        date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
      },
    });
    return Math.min(absences, workingDays);
  }
}
