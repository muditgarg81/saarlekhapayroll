import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

// ── helpers ────────────────────────────────────────────────────────────────
function parseHHMM(s: string): number {
  // returns total minutes from midnight
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Shifts ────────────────────────────────────────────────────────────────
  async getShifts(companyId: string) {
    return this.prisma.shift.findMany({ where: { companyId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createShift(companyId: string, actorId: string, dto: any) {
    const shift = await this.prisma.shift.create({ data: { ...dto, companyId } });
    // If this is marked default, unmark others
    if (dto.isDefault) {
      await this.prisma.shift.updateMany({ where: { companyId, id: { not: shift.id } }, data: { isDefault: false } });
    }
    await this.audit.log(actorId, companyId, 'CREATE', 'Shift', shift.id, `Shift "${shift.name}" created`);
    return shift;
  }

  async updateShift(id: string, companyId: string, actorId: string, dto: any) {
    const existing = await this.prisma.shift.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Shift not found');
    if (dto.isDefault) {
      await this.prisma.shift.updateMany({ where: { companyId, id: { not: id } }, data: { isDefault: false } });
    }
    const updated = await this.prisma.shift.update({ where: { id }, data: dto });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Shift', id, `Shift "${updated.name}" updated`);
    return updated;
  }

  async deleteShift(id: string, companyId: string, actorId: string) {
    const existing = await this.prisma.shift.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Shift not found');
    await this.prisma.shift.update({ where: { id }, data: { isActive: false } });
    await this.audit.log(actorId, companyId, 'DELETE', 'Shift', id, `Shift "${existing.name}" deactivated`);
    return { success: true };
  }

  // ── Roster ────────────────────────────────────────────────────────────────
  async getRoster(companyId: string, month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0);
    return this.prisma.shiftRoster.findMany({
      where: { companyId, fromDate: { lte: to }, toDate: { gte: from } },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true } }, shift: true },
      orderBy: { employee: { firstName: 'asc' } },
    });
  }

  async assignShift(companyId: string, actorId: string, dto: { employeeIds: string[]; shiftId: string; fromDate: string; toDate: string }) {
    const shift = await this.prisma.shift.findFirst({ where: { id: dto.shiftId, companyId } });
    if (!shift) throw new NotFoundException('Shift not found');

    const from = new Date(dto.fromDate);
    const to   = new Date(dto.toDate);
    const created: string[] = [];

    for (const empId of dto.employeeIds) {
      const r = await this.prisma.shiftRoster.create({
        data: { companyId, employeeId: empId, shiftId: dto.shiftId, fromDate: from, toDate: to, createdBy: actorId },
      });
      created.push(r.id);
    }

    await this.audit.log(actorId, companyId, 'CREATE', 'ShiftRoster', null, `Shift "${shift.name}" assigned to ${dto.employeeIds.length} employee(s)`);
    return { assigned: created.length };
  }

  async deleteRosterEntry(id: string, companyId: string, actorId: string) {
    const r = await this.prisma.shiftRoster.findFirst({ where: { id, companyId } });
    if (!r) throw new NotFoundException('Roster entry not found');
    await this.prisma.shiftRoster.delete({ where: { id } });
    await this.audit.log(actorId, companyId, 'DELETE', 'ShiftRoster', id, 'Roster entry removed');
    return { success: true };
  }

  // ── Mark / Update Attendance ──────────────────────────────────────────────
  async markAttendance(
    employeeId: string,
    dto: { date: string; status: string; checkIn?: string; checkOut?: string; notes?: string; source?: string },
  ) {
    const date = new Date(dto.date);
    const checkIn  = dto.checkIn  ? new Date(dto.checkIn)  : undefined;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : undefined;

    // Compute OT and late minutes if shift is found
    const { overtimeMinutes, lateMinutes, shiftId } = await this._computeShiftMetrics(employeeId, date, checkIn, checkOut);

    return this.prisma.attendance.upsert({
      where:  { employeeId_date: { employeeId, date } },
      create: { employeeId, date, status: dto.status, checkIn, checkOut, notes: dto.notes, source: dto.source || 'MANUAL', overtimeMinutes, lateMinutes, shiftId },
      update: { status: dto.status, checkIn, checkOut, notes: dto.notes, source: dto.source || 'MANUAL', overtimeMinutes, lateMinutes, shiftId },
    });
  }

  private async _computeShiftMetrics(
    employeeId: string,
    date: Date,
    checkIn?: Date,
    checkOut?: Date,
  ): Promise<{ overtimeMinutes: number; lateMinutes: number; shiftId: string | null }> {
    // Find active roster for this date
    const roster = await this.prisma.shiftRoster.findFirst({
      where: { employeeId, fromDate: { lte: date }, toDate: { gte: date } },
      include: { shift: true },
      orderBy: { fromDate: 'desc' },
    });

    if (!roster || !checkIn || !checkOut) {
      // Fallback: use default shift for the company
      const rec = await this.prisma.attendance.findFirst({ where: { employeeId }, select: { employee: { select: { companyId: true } } } }).catch(() => null);
      const companyId = rec?.employee?.companyId;
      const defaultShift = companyId ? await this.prisma.shift.findFirst({ where: { companyId, isDefault: true } }).catch(() => null) : null;
      if (!defaultShift || !checkIn || !checkOut) return { overtimeMinutes: 0, lateMinutes: 0, shiftId: null };
      return this._calcMetrics(defaultShift, checkIn, checkOut);
    }

    return this._calcMetrics(roster.shift, checkIn, checkOut);
  }

  private _calcMetrics(shift: any, checkIn: Date, checkOut: Date): { overtimeMinutes: number; lateMinutes: number; shiftId: string } {
    const shiftStartMins = parseHHMM(shift.startTime);
    const shiftEndMins   = parseHHMM(shift.endTime);
    const shiftDuration  = shiftEndMins > shiftStartMins
      ? shiftEndMins - shiftStartMins
      : (1440 - shiftStartMins) + shiftEndMins; // night shift crosses midnight

    // actual worked minutes
    const workedMins = diffMinutes(checkIn, checkOut);

    // Late arrival
    const checkInMins = checkIn.getHours() * 60 + checkIn.getMinutes();
    const rawLate     = checkInMins - shiftStartMins;
    const lateMinutes = Math.max(0, rawLate - shift.graceMinutes);

    // Overtime: worked beyond shift duration + overtime threshold
    const overtimeMinutes = Math.max(0, workedMins - shiftDuration - (shift.overtimeAfterMinutes || 0));

    return { overtimeMinutes, lateMinutes, shiftId: shift.id };
  }

  // ── Bulk import ──────────────────────────────────────────────────────────
  async bulkImport(records: { employeeId: string; date: string; status: string; checkIn?: string; checkOut?: string; source?: string }[]) {
    const results = await Promise.allSettled(records.map(r => this.markAttendance(r.employeeId, r)));
    return { total: records.length, success: results.filter(r => r.status === 'fulfilled').length, failed: results.filter(r => r.status === 'rejected').length };
  }

  /**
   * Biometric CSV import format: employeeCode,date(YYYY-MM-DD),checkIn(HH:mm),checkOut(HH:mm)
   */
  async biometricImport(companyId: string, actorId: string, csv: string) {
    const lines = csv.trim().split('\n').slice(1); // skip header
    const employees = await this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true, employeeCode: true } });
    const codeToId  = Object.fromEntries(employees.map(e => [e.employeeCode, e.id]));

    const records: any[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const [code, dateStr, checkIn, checkOut] = line.split(',').map(s => s.trim());
      if (!code || !dateStr) continue;
      const empId = codeToId[code];
      if (!empId) { errors.push(`Unknown employee code: ${code}`); continue; }

      records.push({ employeeId: empId, date: dateStr, status: 'PRESENT', checkIn: checkIn ? `${dateStr}T${checkIn}:00` : undefined, checkOut: checkOut ? `${dateStr}T${checkOut}:00` : undefined, source: 'BIOMETRIC' });
    }

    const res = await this.bulkImport(records);
    await this.audit.log(actorId, companyId, 'CREATE', 'Attendance', null, `Biometric import: ${res.success}/${res.total} records imported`);
    return { ...res, errors };
  }

  // ── Get / Query ───────────────────────────────────────────────────────────
  async getAttendance(employeeId: string, month: number, year: number) {
    return this.prisma.attendance.findMany({
      where: { employeeId, date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
      orderBy: { date: 'asc' },
    });
  }

  async getMonthlyReport(companyId: string, month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 1);

    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
    });

    const reports = await Promise.all(employees.map(async emp => {
      const records = await this.prisma.attendance.findMany({ where: { employeeId: emp.id, date: { gte: from, lt: to } } });

      const present  = records.filter(r => r.status === 'PRESENT').length;
      const absent   = records.filter(r => r.status === 'ABSENT').length;
      const halfDay  = records.filter(r => r.status === 'HALF_DAY').length;
      const onLeave  = records.filter(r => r.status === 'ON_LEAVE').length;
      const holiday  = records.filter(r => r.status === 'HOLIDAY').length;
      const weekend  = records.filter(r => r.status === 'WEEKEND').length;
      const totalOT  = records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0);
      const totalLate = records.reduce((s, r) => s + (r.lateMinutes || 0), 0);

      // LOP = absent (excluding approved leaves) + 0.5 × half-days
      const lop = absent + halfDay * 0.5;

      return { ...emp, present, absent, halfDay, onLeave, holiday, weekend, lop, overtimeMinutes: totalOT, overtimeHours: +(totalOT / 60).toFixed(2), lateMinutes: totalLate };
    }));

    return reports;
  }

  // Used by payroll engine to get LOP for salary deduction
  async getLOPForPayroll(companyId: string, month: number, year: number): Promise<Record<string, number>> {
    const report = await this.getMonthlyReport(companyId, month, year);
    return Object.fromEntries(report.map(r => [r.id, r.lop]));
  }

  // ── Regularization ────────────────────────────────────────────────────────
  async applyRegularization(employeeId: string, companyId: string, dto: { date: string; requestedStatus: string; checkIn?: string; checkOut?: string; reason: string }) {
    // validate employee belongs to company
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!emp) throw new ForbiddenException();

    // Check if there's already a pending request for this date
    const existing = await this.prisma.attendanceRegularization.findFirst({
      where: { employeeId, date: new Date(dto.date), status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('A pending regularization already exists for this date');

    return this.prisma.attendanceRegularization.create({
      data: { employeeId, date: new Date(dto.date), requestedStatus: dto.requestedStatus, checkIn: dto.checkIn, checkOut: dto.checkOut, reason: dto.reason },
    });
  }

  async getRegularizations(companyId: string, filters: { employeeId?: string; status?: string }) {
    const where: any = { employee: { companyId } };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status)     where.status     = filters.status;
    return this.prisma.attendanceRegularization.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewRegularization(id: string, companyId: string, actorId: string, status: 'APPROVED' | 'REJECTED', comment?: string) {
    const reg = await this.prisma.attendanceRegularization.findFirst({
      where: { id }, include: { employee: { select: { companyId: true } } },
    });
    if (!reg) throw new NotFoundException('Regularization not found');
    if (reg.employee.companyId !== companyId) throw new ForbiddenException();
    if (reg.status !== 'PENDING') throw new BadRequestException('Already reviewed');

    await this.prisma.attendanceRegularization.update({
      where: { id }, data: { status, reviewedBy: actorId, reviewedAt: new Date(), reviewComment: comment },
    });

    // If approved, update the actual attendance record
    if (status === 'APPROVED') {
      const checkIn  = reg.checkIn  ? new Date(`${reg.date.toISOString().split('T')[0]}T${reg.checkIn}:00`) : undefined;
      const checkOut = reg.checkOut ? new Date(`${reg.date.toISOString().split('T')[0]}T${reg.checkOut}:00`) : undefined;
      const { overtimeMinutes, lateMinutes, shiftId } = await this._computeShiftMetrics(reg.employeeId, reg.date, checkIn, checkOut);

      await this.prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: reg.employeeId, date: reg.date } },
        create: { employeeId: reg.employeeId, date: reg.date, status: reg.requestedStatus, checkIn, checkOut, source: 'MANUAL', isRegularized: true, overtimeMinutes, lateMinutes, shiftId },
        update: { status: reg.requestedStatus, checkIn, checkOut, isRegularized: true, overtimeMinutes, lateMinutes, shiftId },
      });
    }

    await this.audit.log(actorId, companyId, status === 'APPROVED' ? 'APPROVE' : 'UPDATE', 'AttendanceRegularization', id, `Regularization ${status.toLowerCase()} for ${reg.date.toISOString().split('T')[0]}`);
    return { success: true };
  }

  // ── Auto-mark weekends / holidays ─────────────────────────────────────────
  async autoSeedMonth(companyId: string, actorId: string, month: number, year: number) {
    const from   = new Date(year, month - 1, 1);
    const to     = new Date(year, month, 0);
    const holidays = await this.prisma.holiday.findMany({ where: { companyId, date: { gte: from, lte: to } } });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    const employees = await this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true } });

    // For each employee, get their default shift to know weekend days
    const defaultShift = await this.prisma.shift.findFirst({ where: { companyId, isDefault: true } });
    const weeklyOffDays: number[] = defaultShift ? JSON.parse(defaultShift.weeklyOffDays || '[0,6]') : [0, 6];

    let seeded = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = weeklyOffDays.includes(d.getDay());
      const isHoliday = holidayDates.has(dateStr);

      if (!isWeekend && !isHoliday) continue;
      const status = isHoliday ? 'HOLIDAY' : 'WEEKEND';

      for (const emp of employees) {
        await this.prisma.attendance.upsert({
          where:  { employeeId_date: { employeeId: emp.id, date: new Date(dateStr) } },
          create: { employeeId: emp.id, date: new Date(dateStr), status, source: 'SYSTEM' },
          update: {},
        });
        seeded++;
      }
    }

    await this.audit.log(actorId, companyId, 'CREATE', 'Attendance', null, `Auto-seeded weekends/holidays for ${month}/${year}: ${seeded} records`);
    return { seeded };
  }
}
