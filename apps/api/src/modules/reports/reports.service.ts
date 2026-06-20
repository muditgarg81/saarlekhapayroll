import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// PF employer split rates (on PF wage)
const PF_EPS_RATE   = 0.0833;  // pension
const PF_EPF_RATE   = 0.0367;  // provident fund (employer share)
const PF_EDLI_RATE  = 0.005;   // insurance
const PF_ADMIN_RATE = 0.005;   // admin charges
const ESI_EMPLOYER_RATE = 0.0325;

const fmtFy = (month: number, year: number) =>
  month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─── Salary Register ────────────────────────────────────────
  async getSalaryRegister(companyId: string, month: number, year: number) {
    const payrun = await this.prisma.payrun.findFirst({
      where: { companyId, month, year, type: 'REGULAR' },
      include: {
        payslips: {
          include: {
            employee: { select: { firstName: true, lastName: true, employeeCode: true, designation: true, pan: true, uan: true } },
            lines: { include: { component: true } },
          },
        },
      },
    });

    if (!payrun) return null;

    return {
      payrunId: payrun.id,
      month, year,
      status: payrun.status,
      employees: payrun.payslips.map(p => ({
        employeeCode: p.employee.employeeCode,
        name: `${p.employee.firstName} ${p.employee.lastName}`,
        designation: p.employee.designation,
        pan: p.employee.pan,
        uan: p.employee.uan,
        workingDays: p.workingDays,
        paidDays: p.paidDays,
        lopDays: p.lopDays,
        earnings: p.lines.filter(l => l.type === 'EARNING').reduce((acc: Record<string, number>, l) => { acc[l.component.code] = l.amount; return acc; }, {}),
        deductions: p.lines.filter(l => l.type === 'DEDUCTION').reduce((acc: Record<string, number>, l) => { acc[l.component.code] = l.amount; return acc; }, {}),
        grossEarnings: p.grossEarnings,
        totalDeductions: p.totalDeductions,
        netPay: p.netPay,
      })),
      summary: {
        totalEmployees: payrun.totalEmployees,
        totalGross: payrun.totalGross,
        totalDeductions: payrun.totalDeductions,
        totalNetPay: payrun.totalNetPay,
      },
    };
  }

  // ─── Cost trend report ──────────────────────────────────────
  async getCostReport(companyId: string, fromMonth: number, fromYear: number, toMonth: number, toYear: number) {
    const payruns = await this.prisma.payrun.findMany({
      where: {
        companyId,
        OR: [
          { year: fromYear, month: { gte: fromMonth } },
          { year: toYear, month: { lte: toMonth } },
          { year: { gt: fromYear, lt: toYear } },
        ],
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    return payruns.map(p => ({
      month: p.month, year: p.year,
      employees: p.totalEmployees,
      grossPay: p.totalGross,
      netPay: p.totalNetPay,
      deductions: p.totalDeductions,
    }));
  }

  // ─── Department-wise cost analysis ──────────────────────────
  async getDepartmentCost(companyId: string, month: number, year: number) {
    const payrun = await this.prisma.payrun.findFirst({
      where: { companyId, month, year, type: 'REGULAR' },
      include: {
        payslips: {
          include: {
            employee: { select: { departmentId: true, ctc: true } },
            lines: { include: { component: true } },
          },
        },
      },
    });

    const departments = await this.prisma.department.findMany({ where: { companyId } });
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

    if (!payrun) {
      return { month, year, found: false, departments: [], totals: { headcount: 0, gross: 0, net: 0, deductions: 0, employerCost: 0 } };
    }

    const grouped: Record<string, { headcount: number; gross: number; net: number; deductions: number; employerPF: number; employerESI: number }> = {};

    for (const p of payrun.payslips) {
      const deptId = p.employee.departmentId || 'unknown';
      if (!grouped[deptId]) grouped[deptId] = { headcount: 0, gross: 0, net: 0, deductions: 0, employerPF: 0, employerESI: 0 };
      const g = grouped[deptId];
      g.headcount += 1;
      g.gross += p.grossEarnings;
      g.net += p.netPay;
      g.deductions += p.totalDeductions;
      g.employerPF  += p.lines.find(l => l.component.code === 'PF_EMPLOYER')?.amount || 0;
      g.employerESI += Math.round((p.lines.filter(l => l.type === 'EARNING').reduce((s, l) => s + l.amount, 0)) <= 21000
        ? (p.grossEarnings * ESI_EMPLOYER_RATE) : 0);
    }

    const deptRows = Object.entries(grouped).map(([deptId, g]) => {
      const employerCost = g.gross + g.employerPF + g.employerESI;
      return {
        department: deptMap[deptId] || 'Unassigned',
        headcount: g.headcount,
        gross: Math.round(g.gross),
        net: Math.round(g.net),
        deductions: Math.round(g.deductions),
        employerPF: Math.round(g.employerPF),
        employerESI: Math.round(g.employerESI),
        employerCost: Math.round(employerCost),
        avgCost: Math.round(employerCost / g.headcount),
      };
    }).sort((a, b) => b.employerCost - a.employerCost);

    const totals = deptRows.reduce((t, d) => ({
      headcount: t.headcount + d.headcount,
      gross: t.gross + d.gross,
      net: t.net + d.net,
      deductions: t.deductions + d.deductions,
      employerCost: t.employerCost + d.employerCost,
    }), { headcount: 0, gross: 0, net: 0, deductions: 0, employerCost: 0 });

    return { month, year, found: true, departments: deptRows, totals };
  }

  // ─── Headcount ──────────────────────────────────────────────
  async getHeadcountReport(companyId: string) {
    const [total, active, departments] = await Promise.all([
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: { companyId, status: 'ACTIVE' }, _count: { _all: true } }),
    ]);

    const deptDetails = await Promise.all(departments.map(async d => {
      const dept = await this.prisma.department.findUnique({ where: { id: d.departmentId } });
      return { department: dept?.name || 'Unknown', count: d._count._all };
    }));

    return { total, active, terminated: total - active, byDepartment: deptDetails };
  }

  // ─── Statutory challan reports (PF / ESI / PT) ──────────────
  private async _getPayslipsWithLines(companyId: string, month: number, year: number) {
    return this.prisma.payslip.findMany({
      where: { payrun: { companyId, month, year }, status: { in: ['FINALIZED', 'PAID'] } },
      include: {
        employee: { select: { uan: true, esiNumber: true, pan: true, firstName: true, lastName: true, employeeCode: true, state: true } },
        lines: { include: { component: true } },
      },
    });
  }

  async getPFChallan(companyId: string, month: number, year: number) {
    const payslips = await this._getPayslipsWithLines(companyId, month, year);

    const rows = payslips.map(p => {
      const pfEmployee = p.lines.find(l => l.component.code === 'PF_EMPLOYEE')?.amount || 0;
      const pfEmployerTotal = p.lines.find(l => l.component.code === 'PF_EMPLOYER')?.amount || 0;
      // PF wage basis (cap ₹15,000) ≈ pfEmployee / 0.12
      const pfWage = pfEmployee > 0 ? Math.round(pfEmployee / 0.12) : 0;
      const eps   = Math.round(pfWage * PF_EPS_RATE);
      const epf   = Math.round(pfWage * PF_EPF_RATE);
      const edli  = Math.round(pfWage * PF_EDLI_RATE);
      const admin = Math.round(pfWage * PF_ADMIN_RATE);
      return {
        uan: p.employee.uan, name: `${p.employee.firstName} ${p.employee.lastName}`, employeeCode: p.employee.employeeCode,
        pfWage, pfEmployee, eps, epf, edli, admin,
        totalEmployer: epf + eps + edli + admin,
        total: pfEmployee + epf + eps + edli + admin,
      };
    }).filter(r => r.pfEmployee > 0 || r.pfWage > 0);

    const totals = rows.reduce((t, r) => ({
      pfWage: t.pfWage + r.pfWage, pfEmployee: t.pfEmployee + r.pfEmployee,
      eps: t.eps + r.eps, epf: t.epf + r.epf, edli: t.edli + r.edli, admin: t.admin + r.admin,
      total: t.total + r.total,
    }), { pfWage: 0, pfEmployee: 0, eps: 0, epf: 0, edli: 0, admin: 0, total: 0 });

    return { month, year, employeeCount: rows.length, rows, totals };
  }

  async getESIChallan(companyId: string, month: number, year: number) {
    const payslips = await this._getPayslipsWithLines(companyId, month, year);

    const rows = payslips.map(p => {
      const esiEmployee = p.lines.find(l => l.component.code === 'ESI_EMPLOYEE')?.amount || 0;
      const grossWage = p.grossEarnings;
      // ESI applies only if gross ≤ ₹21,000
      const applicable = grossWage <= 21000 && esiEmployee > 0;
      const esiEmployer = applicable ? Math.round(grossWage * ESI_EMPLOYER_RATE) : 0;
      return {
        esiNumber: p.employee.esiNumber, name: `${p.employee.firstName} ${p.employee.lastName}`, employeeCode: p.employee.employeeCode,
        grossWage, esiEmployee, esiEmployer, total: esiEmployee + esiEmployer, applicable,
      };
    }).filter(r => r.applicable);

    const totals = rows.reduce((t, r) => ({
      grossWage: t.grossWage + r.grossWage, esiEmployee: t.esiEmployee + r.esiEmployee,
      esiEmployer: t.esiEmployer + r.esiEmployer, total: t.total + r.total,
    }), { grossWage: 0, esiEmployee: 0, esiEmployer: 0, total: 0 });

    return { month, year, employeeCount: rows.length, rows, totals };
  }

  async getPTChallan(companyId: string, month: number, year: number) {
    const payslips = await this._getPayslipsWithLines(companyId, month, year);

    const rows = payslips.map(p => ({
      name: `${p.employee.firstName} ${p.employee.lastName}`, employeeCode: p.employee.employeeCode,
      state: p.employee.state, gross: p.grossEarnings,
      pt: p.lines.find(l => l.component.code === 'PT')?.amount || 0,
    })).filter(r => r.pt > 0);

    // group by state (PT is remitted state-wise)
    const byState: Record<string, { count: number; total: number }> = {};
    for (const r of rows) {
      const st = r.state || 'Unknown';
      if (!byState[st]) byState[st] = { count: 0, total: 0 };
      byState[st].count += 1;
      byState[st].total += r.pt;
    }

    const totalPT = rows.reduce((s, r) => s + r.pt, 0);
    return { month, year, employeeCount: rows.length, rows, byState, totalPT };
  }

  // ─── Year-end tax report (FY summary per employee) ──────────
  async getYearEndTaxReport(companyId: string, financialYear: string) {
    const [fromYr] = financialYear.split('-').map(Number);
    // FY Apr (fromYr) → Mar (fromYr+1)
    const payslips = await this.prisma.payslip.findMany({
      where: {
        payrun: { companyId },
        status: { in: ['FINALIZED', 'PAID'] },
        OR: [
          { year: fromYr, month: { gte: 4 } },
          { year: fromYr + 1, month: { lte: 3 } },
        ],
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, pan: true } },
        lines: { include: { component: true } },
      },
    });

    const byEmp: Record<string, any> = {};
    for (const p of payslips) {
      const id = p.employeeId;
      if (!byEmp[id]) byEmp[id] = {
        employeeCode: p.employee.employeeCode, name: `${p.employee.firstName} ${p.employee.lastName}`, pan: p.employee.pan,
        grossEarnings: 0, pfDeducted: 0, ptDeducted: 0, tdsDeducted: 0, totalDeductions: 0, netPaid: 0, monthsPaid: 0,
      };
      const e = byEmp[id];
      e.grossEarnings += p.grossEarnings;
      e.totalDeductions += p.totalDeductions;
      e.netPaid += p.netPay;
      e.monthsPaid += 1;
      e.pfDeducted += p.lines.find(l => l.component.code === 'PF_EMPLOYEE')?.amount || 0;
      e.ptDeducted += p.lines.find(l => l.component.code === 'PT')?.amount || 0;
      e.tdsDeducted += p.lines.find(l => l.component.code === 'TDS')?.amount || 0;
    }

    const rows = Object.values(byEmp).map((e: any) => ({
      ...e,
      grossEarnings: Math.round(e.grossEarnings),
      pfDeducted: Math.round(e.pfDeducted),
      ptDeducted: Math.round(e.ptDeducted),
      tdsDeducted: Math.round(e.tdsDeducted),
      totalDeductions: Math.round(e.totalDeductions),
      netPaid: Math.round(e.netPaid),
    })).sort((a, b) => b.grossEarnings - a.grossEarnings);

    const totals = rows.reduce((t, r) => ({
      grossEarnings: t.grossEarnings + r.grossEarnings,
      pfDeducted: t.pfDeducted + r.pfDeducted,
      ptDeducted: t.ptDeducted + r.ptDeducted,
      tdsDeducted: t.tdsDeducted + r.tdsDeducted,
      netPaid: t.netPaid + r.netPaid,
    }), { grossEarnings: 0, pfDeducted: 0, ptDeducted: 0, tdsDeducted: 0, netPaid: 0 });

    return { financialYear, employeeCount: rows.length, rows, totals };
  }

  // ─── Custom report builder ──────────────────────────────────
  private static readonly TEXT_FIELDS = ['employeeCode', 'name', 'designation', 'department', 'pan', 'uan'];

  private _isTextField(col: string) { return ReportsService.TEXT_FIELDS.includes(col); }

  /**
   * Build an ad-hoc tabular report from payslip data.
   * Supports single-month or multi-month aggregation (values summed per employee).
   * dto: {
   *   periodMode?: 'single' | 'range'
   *   month, year,                                    // single
   *   fromMonth, fromYear, toMonth, toYear,           // range
   *   payrunType?: 'REGULAR' | 'ALL'
   *   columns: string[]                               // standard fields or component codes
   *   groupBy?: 'department' | 'designation' | null
   *   filters?: { departmentId?, designation?, employmentType?, search?, minNet?, maxNet?, minGross?, maxGross? }
   *   sortBy?: string, sortDir?: 'asc' | 'desc'
   * }
   */
  async buildCustomReport(companyId: string, dto: any) {
    const { columns, groupBy, filters = {}, sortBy, sortDir = 'desc', payrunType = 'REGULAR' } = dto;
    if (!Array.isArray(columns) || columns.length === 0) throw new BadRequestException('At least one column is required');

    // Resolve period window
    const range = this._resolvePeriod(dto);
    if (!range) throw new BadRequestException('A valid period (single month or range) is required');
    const { fromKey, toKey, label: periodLabel, single } = range;

    const typeFilter = payrunType && payrunType !== 'ALL' ? { type: 'REGULAR' } : {};
    const payruns = await this.prisma.payrun.findMany({
      where: { companyId, ...typeFilter },
      include: {
        payslips: {
          include: {
            employee: { include: { department: { select: { name: true } } } },
            lines: { include: { component: true } },
          },
        },
      },
    });

    // keep only payruns within [fromKey, toKey]
    const inWindow = payruns.filter(p => {
      const k = p.year * 12 + p.month;
      return k >= fromKey && k <= toKey;
    });
    const periodsIncluded = inWindow.length;

    if (periodsIncluded === 0) {
      return { found: false, periodLabel, single, columns, rows: [], groups: null, totals: null, count: 0, periodsIncluded: 0 };
    }

    // Flatten payslips, apply employee-attribute filters
    let payslips = inWindow.flatMap(p => p.payslips);
    if (filters.departmentId)   payslips = payslips.filter(p => p.employee.departmentId === filters.departmentId);
    if (filters.designation)    payslips = payslips.filter(p => p.employee.designation === filters.designation);
    if (filters.employmentType) payslips = payslips.filter(p => p.employee.employmentType === filters.employmentType);
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      payslips = payslips.filter(p =>
        `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q) ||
        p.employee.employeeCode.toLowerCase().includes(q));
    }

    // Aggregate per employee across periods
    const emp: Record<string, { meta: any; metaKey: number; numeric: Record<string, number>; periods: number }> = {};
    for (const p of payslips) {
      const id = p.employeeId;
      const key = p.year * 12 + p.month;
      if (!emp[id]) emp[id] = { meta: null, metaKey: -1, numeric: {}, periods: 0 };
      const e = emp[id];
      if (key >= e.metaKey) {
        e.metaKey = key;
        e.meta = {
          employeeCode: p.employee.employeeCode,
          name: `${p.employee.firstName} ${p.employee.lastName}`,
          designation: p.employee.designation,
          department: p.employee.department?.name || 'Unassigned',
          pan: p.employee.pan,
          uan: p.employee.uan || '—',
        };
      }
      e.periods += 1;
      e.numeric.workingDays     = (e.numeric.workingDays     || 0) + p.workingDays;
      e.numeric.paidDays        = (e.numeric.paidDays        || 0) + p.paidDays;
      e.numeric.lopDays         = (e.numeric.lopDays         || 0) + p.lopDays;
      e.numeric.grossEarnings   = (e.numeric.grossEarnings   || 0) + p.grossEarnings;
      e.numeric.totalDeductions = (e.numeric.totalDeductions || 0) + p.totalDeductions;
      e.numeric.netPay          = (e.numeric.netPay          || 0) + p.netPay;
      for (const l of p.lines) e.numeric[l.component.code] = (e.numeric[l.component.code] || 0) + l.amount;
    }

    // Build rows for the selected columns
    let rows = Object.values(emp).map(e => {
      const row: Record<string, any> = {};
      for (const col of columns) {
        if (this._isTextField(col)) row[col] = e.meta?.[col] ?? '—';
        else row[col] = Math.round(e.numeric[col] ?? 0);
      }
      row.__deptName = e.meta?.department ?? 'Unassigned';
      row.__designation = e.meta?.designation ?? '—';
      row.__periods = e.periods;
      return row;
    });

    // Amount filters on aggregated totals
    if (filters.minNet != null)   rows = rows.filter(r => (r.netPay ?? 0) >= filters.minNet);
    if (filters.maxNet != null)   rows = rows.filter(r => (r.netPay ?? 0) <= filters.maxNet);
    if (filters.minGross != null) rows = rows.filter(r => (r.grossEarnings ?? 0) >= filters.minGross);
    if (filters.maxGross != null) rows = rows.filter(r => (r.grossEarnings ?? 0) <= filters.maxGross);

    // Sorting
    const sortCol = sortBy && columns.includes(sortBy) ? sortBy : (columns.find((c: string) => !this._isTextField(c)) || columns[0]);
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    const numericCols = columns.filter((c: string) => !this._isTextField(c));

    // Totals across all rows
    const totals: Record<string, number> = {};
    for (const c of numericCols) totals[c] = rows.reduce((s, r) => s + (typeof r[c] === 'number' ? r[c] : 0), 0);

    // Optional grouping
    let groups = null;
    if (groupBy === 'department' || groupBy === 'designation') {
      const keyField = groupBy === 'department' ? '__deptName' : '__designation';
      const map: Record<string, any> = {};
      for (const r of rows) {
        const k = r[keyField];
        if (!map[k]) { map[k] = { group: k, count: 0 }; numericCols.forEach((c: string) => map[k][c] = 0); }
        map[k].count += 1;
        numericCols.forEach((c: string) => map[k][c] += (typeof r[c] === 'number' ? r[c] : 0));
      }
      groups = Object.values(map).sort((a: any, b: any) => {
        const c = numericCols[0];
        return c ? (b[c] - a[c]) : String(a.group).localeCompare(String(b.group));
      });
    }

    const cleanRows = rows.map(({ __deptName, __designation, __periods, ...rest }) => rest);
    return { found: true, periodLabel, single, periodsIncluded, columns, rows: cleanRows, groups, totals, count: cleanRows.length };
  }

  /** Resolve single/range period into month-key bounds (year*12+month). */
  private _resolvePeriod(dto: any): { fromKey: number; toKey: number; label: string; single: boolean } | null {
    const M = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (dto.periodMode === 'range' && dto.fromMonth && dto.fromYear && dto.toMonth && dto.toYear) {
      const fromKey = dto.fromYear * 12 + dto.fromMonth;
      const toKey   = dto.toYear * 12 + dto.toMonth;
      if (toKey < fromKey) return null;
      return { fromKey, toKey, label: `${M[dto.fromMonth]} ${dto.fromYear} – ${M[dto.toMonth]} ${dto.toYear}`, single: false };
    }
    if (dto.month && dto.year) {
      const key = dto.year * 12 + dto.month;
      return { fromKey: key, toKey: key, label: `${M[dto.month]} ${dto.year}`, single: true };
    }
    return null;
  }

  // available fields + filter options for custom builder UI
  async getReportFields(companyId: string) {
    const [components, departments, employees] = await Promise.all([
      this.prisma.salaryComponent.findMany({ where: { companyId, isActive: true }, select: { code: true, name: true, type: true }, orderBy: { type: 'asc' } }),
      this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.employee.findMany({ where: { companyId }, select: { designation: true, employmentType: true } }),
    ]);

    const designations    = Array.from(new Set(employees.map(e => e.designation).filter(Boolean))).sort();
    const employmentTypes = Array.from(new Set(employees.map(e => e.employmentType).filter(Boolean))).sort();

    return {
      standardFields: [
        { key: 'employeeCode', label: 'Employee Code', kind: 'text' },
        { key: 'name', label: 'Name', kind: 'text' },
        { key: 'designation', label: 'Designation', kind: 'text' },
        { key: 'department', label: 'Department', kind: 'text' },
        { key: 'pan', label: 'PAN', kind: 'text' },
        { key: 'uan', label: 'UAN', kind: 'text' },
        { key: 'workingDays', label: 'Working Days', kind: 'number' },
        { key: 'paidDays', label: 'Paid Days', kind: 'number' },
        { key: 'lopDays', label: 'LOP Days', kind: 'number' },
        { key: 'grossEarnings', label: 'Gross Earnings', kind: 'currency' },
        { key: 'totalDeductions', label: 'Total Deductions', kind: 'currency' },
        { key: 'netPay', label: 'Net Pay', kind: 'currency' },
      ],
      componentFields: components.map(c => ({ key: c.code, label: c.name, kind: 'currency', type: c.type })),
      filterOptions: { departments, designations, employmentTypes },
    };
  }

  // ─── Saved report templates ─────────────────────────────────
  async listTemplates(companyId: string) {
    return this.prisma.reportTemplate.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async saveTemplate(companyId: string, actorId: string, dto: { name: string; description?: string; config: any }) {
    if (!dto.name?.trim()) throw new BadRequestException('Template name is required');
    return this.prisma.reportTemplate.upsert({
      where:  { companyId_name: { companyId, name: dto.name.trim() } },
      update: { description: dto.description, config: dto.config },
      create: { companyId, name: dto.name.trim(), description: dto.description, config: dto.config, createdBy: actorId },
    });
  }

  async deleteTemplate(id: string, companyId: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id, companyId } });
    if (!t) throw new BadRequestException('Template not found');
    await this.prisma.reportTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ─── Legacy PF (kept for backwards compat) ─────────────────
  async getPFReport(companyId: string, month: number, year: number) {
    const challan = await this.getPFChallan(companyId, month, year);
    return challan.rows.map(r => ({ uan: r.uan, name: r.name, pfEmployee: r.pfEmployee }));
  }
}
