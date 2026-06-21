import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

// India national + major state holidays keyed by state (null = all states)
const INDIA_NATIONAL_HOLIDAYS_2025 = [
  { name: 'New Year\'s Day',      date: '2025-01-01', type: 'NATIONAL', states: null },
  { name: 'Makar Sankranti',       date: '2025-01-14', type: 'STATE',    states: ['Gujarat','Tamil Nadu','Karnataka','Andhra Pradesh','Telangana'] },
  { name: 'Pongal',                date: '2025-01-14', type: 'STATE',    states: ['Tamil Nadu'] },
  { name: 'Republic Day',          date: '2025-01-26', type: 'NATIONAL', states: null },
  { name: 'Maha Shivratri',        date: '2025-02-26', type: 'NATIONAL', states: null },
  { name: 'Holi',                  date: '2025-03-14', type: 'NATIONAL', states: null },
  { name: 'Ugadi',                 date: '2025-03-30', type: 'STATE',    states: ['Karnataka','Andhra Pradesh','Telangana'] },
  { name: 'Gudi Padwa',            date: '2025-03-30', type: 'STATE',    states: ['Maharashtra'] },
  { name: 'Ram Navami',            date: '2025-04-06', type: 'NATIONAL', states: null },
  { name: 'Ambedkar Jayanti',      date: '2025-04-14', type: 'NATIONAL', states: null },
  { name: 'Tamil New Year',        date: '2025-04-14', type: 'STATE',    states: ['Tamil Nadu'] },
  { name: 'Good Friday',           date: '2025-04-18', type: 'NATIONAL', states: null },
  { name: 'Maharashtra Day',       date: '2025-05-01', type: 'STATE',    states: ['Maharashtra'] },
  { name: 'Labour Day',            date: '2025-05-01', type: 'NATIONAL', states: null },
  { name: 'Id-ul-Fitr (Eid)',      date: '2025-03-31', type: 'NATIONAL', states: null },
  { name: 'Bakri Eid',             date: '2025-06-07', type: 'NATIONAL', states: null },
  { name: 'Muharram',              date: '2025-07-06', type: 'NATIONAL', states: null },
  { name: 'Independence Day',      date: '2025-08-15', type: 'NATIONAL', states: null },
  { name: 'Janmashtami',           date: '2025-08-16', type: 'NATIONAL', states: null },
  { name: 'Ganesh Chaturthi',      date: '2025-08-27', type: 'STATE',    states: ['Maharashtra','Karnataka','Andhra Pradesh','Telangana','Goa'] },
  { name: 'Gandhi Jayanti',        date: '2025-10-02', type: 'NATIONAL', states: null },
  { name: 'Navratri / Dussehra',   date: '2025-10-02', type: 'NATIONAL', states: null },
  { name: 'Diwali',                date: '2025-10-20', type: 'NATIONAL', states: null },
  { name: 'Diwali (Lakshmi Puja)', date: '2025-10-20', type: 'NATIONAL', states: null },
  { name: 'Bhai Dooj',             date: '2025-10-22', type: 'NATIONAL', states: null },
  { name: 'Karnataka Rajyotsava',  date: '2025-11-01', type: 'STATE',    states: ['Karnataka'] },
  { name: 'Guru Nanak Jayanti',    date: '2025-11-05', type: 'NATIONAL', states: null },
  { name: 'Christmas Day',         date: '2025-12-25', type: 'NATIONAL', states: null },
];

const INDIA_NATIONAL_HOLIDAYS_2026 = [
  { name: 'New Year\'s Day',       date: '2026-01-01', type: 'NATIONAL', states: null },
  { name: 'Republic Day',          date: '2026-01-26', type: 'NATIONAL', states: null },
  { name: 'Holi',                  date: '2026-03-03', type: 'NATIONAL', states: null },
  { name: 'Ambedkar Jayanti',      date: '2026-04-14', type: 'NATIONAL', states: null },
  { name: 'Good Friday',           date: '2026-04-03', type: 'NATIONAL', states: null },
  { name: 'Labour Day',            date: '2026-05-01', type: 'NATIONAL', states: null },
  { name: 'Independence Day',      date: '2026-08-15', type: 'NATIONAL', states: null },
  { name: 'Gandhi Jayanti',        date: '2026-10-02', type: 'NATIONAL', states: null },
  { name: 'Diwali',                date: '2026-11-08', type: 'NATIONAL', states: null },
  { name: 'Guru Nanak Jayanti',    date: '2026-11-24', type: 'NATIONAL', states: null },
  { name: 'Christmas Day',         date: '2026-12-25', type: 'NATIONAL', states: null },
];

const HOLIDAYS_BY_YEAR: Record<number, typeof INDIA_NATIONAL_HOLIDAYS_2025> = {
  2025: INDIA_NATIONAL_HOLIDAYS_2025,
  2026: INDIA_NATIONAL_HOLIDAYS_2026,
};

const DEFAULT_LEAVE_POLICIES = [
  { leaveType: 'EL', name: 'Earned Leave',        annualAllotment: 18, carryForwardAllowed: true,  maxCarryForward: 30,  encashmentAllowed: true,  isPaid: true,  color: '#22c55e', requiresApproval: true,  maxConsecutiveDays: 15 },
  { leaveType: 'CL', name: 'Casual Leave',         annualAllotment: 12, carryForwardAllowed: false, maxCarryForward: null, encashmentAllowed: false, isPaid: true,  color: '#3b82f6', requiresApproval: true,  maxConsecutiveDays: 3  },
  { leaveType: 'SL', name: 'Sick Leave',            annualAllotment: 10, carryForwardAllowed: false, maxCarryForward: null, encashmentAllowed: false, isPaid: true,  color: '#f59e0b', requiresApproval: false, maxConsecutiveDays: null },
  { leaveType: 'ML', name: 'Maternity Leave',       annualAllotment: 182, carryForwardAllowed: false, maxCarryForward: null, encashmentAllowed: false, isPaid: true, color: '#ec4899', requiresApproval: true,  maxConsecutiveDays: 182 },
  { leaveType: 'PL', name: 'Paternity Leave',       annualAllotment: 15, carryForwardAllowed: false, maxCarryForward: null, encashmentAllowed: false, isPaid: true,  color: '#8b5cf6', requiresApproval: true,  maxConsecutiveDays: 15 },
  { leaveType: 'LWP', name: 'Leave Without Pay',   annualAllotment: 0,  carryForwardAllowed: false, maxCarryForward: null, encashmentAllowed: false, isPaid: false, color: '#6b7280', requiresApproval: true,  maxConsecutiveDays: null },
  { leaveType: 'CO', name: 'Compensatory Off',      annualAllotment: 0,  carryForwardAllowed: true,  maxCarryForward: 5,   encashmentAllowed: false, isPaid: true,  color: '#14b8a6', requiresApproval: true,  maxConsecutiveDays: null },
];

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private audit:  AuditService,
    private notifications: NotificationsService,
  ) {}

  // ── Policies ──────────────────────────────────────────────
  async getPolicies(companyId: string) {
    return this.prisma.leavePolicy.findMany({ where: { companyId, isActive: true }, orderBy: { leaveType: 'asc' } });
  }

  async createPolicy(companyId: string, actorId: string, dto: any) {
    const policy = await this.prisma.leavePolicy.create({ data: { ...dto, companyId } });
    await this.audit.log(actorId, companyId, 'CREATE', 'LeavePolicy', policy.id, `Leave policy "${policy.name}" created`);
    return policy;
  }

  async updatePolicy(id: string, companyId: string, actorId: string, dto: any) {
    const existing = await this.prisma.leavePolicy.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Policy not found');
    const updated = await this.prisma.leavePolicy.update({ where: { id }, data: dto });
    await this.audit.log(actorId, companyId, 'UPDATE', 'LeavePolicy', id, `Leave policy "${updated.name}" updated`);
    return updated;
  }

  async deletePolicy(id: string, companyId: string, actorId: string) {
    const existing = await this.prisma.leavePolicy.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Policy not found');
    await this.prisma.leavePolicy.update({ where: { id }, data: { isActive: false } });
    await this.audit.log(actorId, companyId, 'DELETE', 'LeavePolicy', id, `Leave policy "${existing.name}" deactivated`);
    return { success: true };
  }

  async seedDefaultPolicies(companyId: string, actorId: string) {
    const created: any[] = [];
    for (const policy of DEFAULT_LEAVE_POLICIES) {
      const existing = await this.prisma.leavePolicy.findFirst({ where: { leaveType: policy.leaveType, companyId } });
      if (!existing) {
        const p = await this.prisma.leavePolicy.create({ data: { ...policy, companyId } });
        created.push(p);
      }
    }
    if (created.length) await this.audit.log(actorId, companyId, 'CREATE', 'LeavePolicy', null, `${created.length} default leave policies seeded`);
    return { seeded: created.length, policies: created };
  }

  // ── Balances ──────────────────────────────────────────────
  async getBalances(employeeId: string, financialYear: string) {
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, financialYear },
      include: { policy: true },
    });
  }

  async getAllBalances(companyId: string, financialYear: string) {
    const balances = await this.prisma.leaveBalance.findMany({
      where: { financialYear, employee: { companyId } },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true } }, policy: true },
    });
    // Group by employee
    const byEmployee: Record<string, any> = {};
    for (const b of balances) {
      const key = b.employeeId;
      if (!byEmployee[key]) byEmployee[key] = { employee: b.employee, balances: [] };
      byEmployee[key].balances.push(b);
    }
    return Object.values(byEmployee);
  }

  async initializeBalances(companyId: string, financialYear: string, actorId: string) {
    const [employees, policies] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true } }),
      this.prisma.leavePolicy.findMany({ where: { companyId, isActive: true } }),
    ]);
    let created = 0;
    for (const emp of employees) {
      for (const policy of policies) {
        await this.prisma.leaveBalance.upsert({
          where:  { employeeId_leavePolicyId_financialYear: { employeeId: emp.id, leavePolicyId: policy.id, financialYear } },
          update: {},
          create: { employeeId: emp.id, leavePolicyId: policy.id, financialYear, allocated: policy.annualAllotment },
        });
        created++;
      }
    }
    await this.audit.log(actorId, companyId, 'CREATE', 'LeaveBalance', null, `Leave balances initialized for FY ${financialYear} — ${employees.length} employees`);
    return { initialized: created };
  }

  // ── Carry Forward ─────────────────────────────────────────
  async processCarryForward(companyId: string, fromFY: string, toFY: string, actorId: string) {
    const policies = await this.prisma.leavePolicy.findMany({ where: { companyId, isActive: true, carryForwardAllowed: true } });
    let carried = 0;

    for (const policy of policies) {
      const balances = await this.prisma.leaveBalance.findMany({
        where: { leavePolicyId: policy.id, financialYear: fromFY },
      });

      for (const bal of balances) {
        const remaining = bal.allocated + bal.carryForward - bal.taken - bal.pending - bal.encashed;
        if (remaining <= 0) continue;
        const carryQty = policy.maxCarryForward ? Math.min(remaining, policy.maxCarryForward) : remaining;

        await this.prisma.leaveBalance.upsert({
          where:  { employeeId_leavePolicyId_financialYear: { employeeId: bal.employeeId, leavePolicyId: policy.id, financialYear: toFY } },
          update: { carryForward: { increment: carryQty } },
          create: { employeeId: bal.employeeId, leavePolicyId: policy.id, financialYear: toFY, allocated: policy.annualAllotment, carryForward: carryQty },
        });
        carried++;
      }
    }

    await this.audit.log(actorId, companyId, 'UPDATE', 'LeaveBalance', null, `Carry forward processed from FY ${fromFY} → ${toFY} for ${carried} balances`);
    return { carried };
  }

  // ── Leave Encashment ──────────────────────────────────────
  async encashLeave(employeeId: string, companyId: string, actorId: string, dto: { leavePolicyId: string; days: number; financialYear: string }) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, include: { salaryStructure: { include: { components: { include: { component: true } } } } } });
    if (!employee) throw new NotFoundException('Employee not found');

    const policy = await this.prisma.leavePolicy.findFirst({ where: { id: dto.leavePolicyId, companyId } });
    if (!policy) throw new NotFoundException('Policy not found');
    if (!policy.encashmentAllowed) throw new BadRequestException(`${policy.name} does not allow encashment`);

    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leavePolicyId_financialYear: { employeeId, leavePolicyId: dto.leavePolicyId, financialYear: dto.financialYear } },
    });
    const available = (balance?.allocated ?? 0) + (balance?.carryForward ?? 0) - (balance?.taken ?? 0) - (balance?.pending ?? 0) - (balance?.encashed ?? 0);
    if (dto.days > available) throw new BadRequestException(`Only ${available} days available for encashment`);

    // Basic salary for encashment rate (Basic / 26 per day)
    const monthlyCtc   = employee.ctc / 12;
    const basicComp    = employee.salaryStructure?.components?.find(c => c.component.code === 'BASIC')?.component;
    const basicPct     = basicComp?.calculationType === 'PERCENTAGE_OF_CTC' ? (basicComp.value as number) / 100 : 0.4;
    const monthlyBasic = monthlyCtc * basicPct;
    const dailyRate    = monthlyBasic / 26;
    const encashAmount = Math.round(dailyRate * dto.days);

    // Deduct from balance
    await this.prisma.leaveBalance.update({
      where: { employeeId_leavePolicyId_financialYear: { employeeId, leavePolicyId: dto.leavePolicyId, financialYear: dto.financialYear } },
      data:  { encashed: { increment: dto.days } },
    });

    await this.audit.log(actorId, companyId, 'UPDATE', 'LeaveBalance', balance?.id, `${dto.days} days of ${policy.name} encashed for ${employee.firstName} ${employee.lastName} = ₹${encashAmount}`);
    return { days: dto.days, dailyRate: Math.round(dailyRate), encashAmount, policy: policy.name };
  }

  // ── Applications ──────────────────────────────────────────
  async apply(employeeId: string, companyId: string, dto: { leavePolicyId: string; fromDate: string; toDate: string; reason: string; isHalfDay?: boolean }) {
    const from    = new Date(dto.fromDate);
    const to      = new Date(dto.toDate);
    const rawDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const days    = dto.isHalfDay ? 0.5 : rawDays;

    const policy = await this.prisma.leavePolicy.findFirst({ where: { id: dto.leavePolicyId, companyId } });
    if (!policy) throw new NotFoundException('Leave policy not found');

    // Consecutive days check
    if (policy.maxConsecutiveDays && days > policy.maxConsecutiveDays) {
      throw new BadRequestException(`${policy.name} cannot exceed ${policy.maxConsecutiveDays} consecutive days`);
    }

    // Balance check
    const fy      = this.getFinancialYear(from);
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leavePolicyId_financialYear: { employeeId, leavePolicyId: policy.id, financialYear: fy } },
    });
    const available = (balance?.allocated ?? 0) + (balance?.carryForward ?? 0) - (balance?.taken ?? 0) - (balance?.pending ?? 0) - (balance?.encashed ?? 0);
    if (policy.isPaid && available < days) {
      throw new BadRequestException(`Insufficient ${policy.name} balance. Available: ${available} days, Requested: ${days} days`);
    }

    // Deduct pending
    await this.prisma.leaveBalance.upsert({
      where:  { employeeId_leavePolicyId_financialYear: { employeeId, leavePolicyId: policy.id, financialYear: fy } },
      create: { employeeId, leavePolicyId: policy.id, financialYear: fy, allocated: policy.annualAllotment, pending: days },
      update: { pending: { increment: days } },
    });

    const status = policy.requiresApproval ? 'PENDING' : 'APPROVED';
    // If no approval needed, directly move to taken
    if (!policy.requiresApproval) {
      await this.prisma.leaveBalance.update({
        where: { employeeId_leavePolicyId_financialYear: { employeeId, leavePolicyId: policy.id, financialYear: fy } },
        data: { pending: { decrement: days }, taken: { increment: days } },
      });
    }

    return this.prisma.leaveApplication.create({
      data: { employeeId, leavePolicyId: policy.id, leaveType: policy.leaveType, fromDate: from, toDate: to, days, reason: dto.reason, status, isHalfDay: dto.isHalfDay ?? false },
    });
  }

  async review(id: string, reviewerId: string, status: 'APPROVED' | 'REJECTED', comment?: string) {
    const app = await this.prisma.leaveApplication.findUnique({
      where: { id },
      include: { employee: { select: { companyId: true } } },
    });
    if (!app) throw new NotFoundException('Leave application not found');
    if (!['PENDING'].includes(app.status)) throw new BadRequestException('Application is no longer pending');

    const updated = await this.prisma.leaveApplication.update({
      where: { id },
      data: { status, reviewedBy: reviewerId, reviewedAt: new Date(), reviewComment: comment },
    });

    if (app.leavePolicyId) {
      const fy = this.getFinancialYear(app.fromDate);
      if (status === 'APPROVED') {
        await this.prisma.leaveBalance.updateMany({
          where: { employeeId: app.employeeId, leavePolicyId: app.leavePolicyId, financialYear: fy },
          data:  { pending: { decrement: app.days }, taken: { increment: app.days } },
        });
      } else {
        await this.prisma.leaveBalance.updateMany({
          where: { employeeId: app.employeeId, leavePolicyId: app.leavePolicyId, financialYear: fy },
          data:  { pending: { decrement: app.days } },
        });
      }
    }
    // Notify the employee of the decision (fire-and-forget)
    this.notifications.notifyLeaveStatus(app.employee.companyId, id).catch(() => {});
    return updated;
  }

  async cancelApplication(id: string, actorId: string, companyId: string, reason?: string) {
    const app = await this.prisma.leaveApplication.findUnique({
      where: { id }, include: { employee: { select: { companyId: true } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.employee.companyId !== companyId) throw new ForbiddenException();
    if (!['PENDING', 'APPROVED'].includes(app.status)) throw new BadRequestException('Cannot cancel this application');

    await this.prisma.leaveApplication.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: actorId, cancelReason: reason },
    });

    // Restore balance
    if (app.leavePolicyId) {
      const fy = this.getFinancialYear(app.fromDate);
      const field = app.status === 'APPROVED' ? 'taken' : 'pending';
      await this.prisma.leaveBalance.updateMany({
        where: { employeeId: app.employeeId, leavePolicyId: app.leavePolicyId, financialYear: fy },
        data: { [field]: { decrement: app.days } },
      });
    }
    return { success: true };
  }

  async getApplications(filters: { employeeId?: string; companyId?: string; status?: string; fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status)     where.status     = filters.status;
    if (filters.companyId)  where.employee   = { companyId: filters.companyId };
    if (filters.fromDate || filters.toDate) {
      where.fromDate = {};
      if (filters.fromDate) where.fromDate.gte = new Date(filters.fromDate);
      if (filters.toDate)   where.fromDate.lte = new Date(filters.toDate);
    }
    return this.prisma.leaveApplication.findMany({
      where,
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true, designation: true } } },
      orderBy: { appliedAt: 'desc' },
    });
  }

  // ── Team Calendar ─────────────────────────────────────────
  async getTeamCalendar(companyId: string, month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0);

    const [applications, holidays] = await Promise.all([
      this.prisma.leaveApplication.findMany({
        where: {
          status: { in: ['APPROVED', 'PENDING'] },
          employee: { companyId },
          OR: [
            { fromDate: { gte: from, lte: to } },
            { toDate:   { gte: from, lte: to } },
            { fromDate: { lte: from }, toDate: { gte: to } },
          ],
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.holiday.findMany({
        where: { companyId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      }),
    ]);

    return { applications, holidays, month, year };
  }

  // ── Holidays ──────────────────────────────────────────────
  async getHolidays(companyId: string, year: number) {
    return this.prisma.holiday.findMany({
      where: { companyId, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(companyId: string, actorId: string, dto: any) {
    const h = await this.prisma.holiday.create({ data: { ...dto, companyId, date: new Date(dto.date), states: dto.states ? JSON.stringify(dto.states) : null } });
    await this.audit.log(actorId, companyId, 'CREATE', 'Holiday', h.id, `Holiday "${h.name}" added on ${dto.date}`);
    return h;
  }

  async deleteHoliday(id: string, companyId: string, actorId: string) {
    const h = await this.prisma.holiday.findFirst({ where: { id, companyId } });
    if (!h) throw new NotFoundException('Holiday not found');
    await this.prisma.holiday.delete({ where: { id } });
    await this.audit.log(actorId, companyId, 'DELETE', 'Holiday', id, `Holiday "${h.name}" deleted`);
    return { success: true };
  }

  async seedHolidays(companyId: string, actorId: string, year: number, state?: string) {
    const template = HOLIDAYS_BY_YEAR[year] || INDIA_NATIONAL_HOLIDAYS_2025;
    let seeded = 0;
    for (const h of template) {
      // Include if national (states: null) or if state matches
      const stateList = h.states as string[] | null;
      const applicable = !stateList || !state || stateList.includes(state);
      if (!applicable) continue;
      try {
        await this.prisma.holiday.upsert({
          where:  { companyId_date_name: { companyId, date: new Date(h.date), name: h.name } },
          update: {},
          create: { companyId, name: h.name, date: new Date(h.date), type: h.type, states: stateList ? JSON.stringify(stateList) : null },
        });
        seeded++;
      } catch { /* skip duplicates */ }
    }
    await this.audit.log(actorId, companyId, 'CREATE', 'Holiday', null, `${seeded} holidays seeded for ${year}${state ? ' · ' + state : ''}`);
    return { seeded };
  }

  // ── Helpers ───────────────────────────────────────────────
  private getFinancialYear(date: Date): string {
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  }
}
