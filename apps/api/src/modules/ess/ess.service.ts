import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const REIMB_CATEGORIES = ['TRAVEL','MEDICAL','FOOD','INTERNET','PHONE','OTHER'];

@Injectable()
export class ESSService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard(employeeId: string) {
    const now = new Date();
    const fy  = now.getMonth() >= 3
      ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;

    const [employee, latestPayslip, leaveBalances, pendingLeave, pendingReimb] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          company:        { select: { name: true, logoUrl: true } },
          department:     { select: { name: true } },
          branch:         { select: { name: true } },
          salaryStructure:{ select: { name: true } },
        },
      }),
      this.prisma.payslip.findFirst({
        where: { employeeId, status: { in: ['FINALIZED', 'PAID'] } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { payrun: { select: { status: true, payDate: true } } },
      }),
      this.prisma.leaveBalance.findMany({
        where: { employeeId, financialYear: fy },
        include: { policy: { select: { name: true, leaveType: true, color: true } } },
      }),
      this.prisma.leaveApplication.count({ where: { employeeId, status: 'PENDING' } }),
      this.prisma.reimbursementClaim.count({ where: { employeeId, status: 'PENDING' } }),
    ]);

    if (!employee) throw new NotFoundException('Employee not found');

    const balanceSummary = leaveBalances.map(b => ({
      leaveType:  b.policy?.leaveType,
      name:       b.policy?.name,
      color:      b.policy?.color,
      available:  +(b.allocated + b.carryForward - b.taken - b.pending - b.encashed).toFixed(1),
      taken:      b.taken,
    }));

    return { employee, latestPayslip, leaveBalances: balanceSummary, pendingLeave, pendingReimb, financialYear: fy };
  }

  // ── Payslips ──────────────────────────────────────────────────────────────
  async getMyPayslips(employeeId: string, year?: number) {
    return this.prisma.payslip.findMany({
      where: { employeeId, ...(year ? { year } : {}), status: { in: ['FINALIZED', 'PAID'] } },
      include: { payrun: { select: { status: true, payDate: true, type: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayslipDetail(payslipId: string, employeeId: string) {
    const p = await this.prisma.payslip.findFirst({
      where: { id: payslipId, employeeId },
      include: {
        employee: {
          include: {
            company:    true,
            department: { select: { name: true } },
            branch:     { select: { name: true, state: true } },
          },
        },
        lines: { include: { component: true }, orderBy: { component: { type: 'asc' } } },
        payrun: true,
      },
    });
    if (!p) throw new NotFoundException('Payslip not found');
    return p;
  }

  async generatePayslipHtml(payslipId: string, employeeId: string): Promise<string> {
    const p = await this.getPayslipDetail(payslipId, employeeId);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const earnings   = p.lines.filter(l => l.type === 'EARNING');
    const deductions = p.lines.filter(l => l.type === 'DEDUCTION');

    const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
    const emp = p.employee;
    const co  = emp.company;

    const earningsRows  = earnings.map(l  => `<tr><td>${l.component.name}</td><td class="amt">${fmt(l.amount)}</td></tr>`).join('');
    const deductionRows = deductions.map(l => `<tr><td>${l.component.name}</td><td class="amt">${fmt(l.amount)}</td></tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payslip – ${months[p.month - 1]} ${p.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; background: #fff; }
    .page { max-width: 820px; margin: 0 auto; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 14px; margin-bottom: 16px; }
    .co-name { font-size: 18px; font-weight: 700; color: #4f46e5; }
    .co-sub { font-size: 11px; color: #666; margin-top: 2px; }
    .slip-title { font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; }
    .slip-period { font-size: 11px; color: #666; text-align: right; margin-top: 2px; }
    .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; background: #f8f8ff; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .emp-row { display: flex; gap: 6px; font-size: 11px; }
    .emp-label { color: #888; min-width: 110px; }
    .emp-val { font-weight: 600; color: #222; }
    .pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .pay-section { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
    .pay-section-header { background: #4f46e5; color: #fff; padding: 7px 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pay-section table { width: 100%; border-collapse: collapse; }
    .pay-section td { padding: 5px 12px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
    .pay-section tr:last-child td { border-bottom: none; }
    td.amt { text-align: right; font-weight: 500; }
    .totals-row td { background: #f0f0ff; font-weight: 700; border-top: 1px solid #c7c7ff; }
    .net-pay { background: #4f46e5; color: white; padding: 14px 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .net-pay-label { font-size: 13px; font-weight: 600; }
    .net-pay-amount { font-size: 22px; font-weight: 700; }
    .footer { border-top: 1px solid #e0e0e0; padding-top: 10px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-finalized { background: #dbeafe; color: #1e40af; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Print button (hidden in print) -->
  <div class="no-print" style="text-align:right;margin-bottom:12px;">
    <button onclick="window.print()" style="background:#4f46e5;color:white;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:13px;">
      🖨️ Download / Print PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="co-name">${co.name}</div>
      <div class="co-sub">${co.legalName} &nbsp;|&nbsp; PAN: ${co.pan}</div>
    </div>
    <div>
      <div class="slip-title">SALARY PAYSLIP</div>
      <div class="slip-period">${months[p.month - 1]} ${p.year}</div>
      <div style="margin-top:4px">
        <span class="badge ${p.status === 'PAID' ? 'badge-paid' : 'badge-finalized'}">${p.status}</span>
      </div>
    </div>
  </div>

  <!-- Employee details -->
  <div class="emp-grid">
    <div class="emp-row"><span class="emp-label">Employee Name</span><span class="emp-val">${emp.firstName} ${emp.lastName}</span></div>
    <div class="emp-row"><span class="emp-label">Employee Code</span><span class="emp-val">${emp.employeeCode}</span></div>
    <div class="emp-row"><span class="emp-label">Designation</span><span class="emp-val">${emp.designation || '—'}</span></div>
    <div class="emp-row"><span class="emp-label">Department</span><span class="emp-val">${emp.department?.name || '—'}</span></div>
    <div class="emp-row"><span class="emp-label">Date of Joining</span><span class="emp-val">${emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN') : '—'}</span></div>
    <div class="emp-row"><span class="emp-label">PAN</span><span class="emp-val">${emp.pan || '—'}</span></div>
    <div class="emp-row"><span class="emp-label">UAN</span><span class="emp-val">${emp.uan || '—'}</span></div>
    <div class="emp-row"><span class="emp-label">Bank A/C</span><span class="emp-val">${(emp as any).bankAccount ? `****${(emp as any).bankAccount.slice(-4)}` : '—'}</span></div>
    <div class="emp-row"><span class="emp-label">Working Days</span><span class="emp-val">${p.workingDays}</span></div>
    <div class="emp-row"><span class="emp-label">Paid Days</span><span class="emp-val">${p.paidDays}${p.lopDays > 0 ? ` (LOP: ${p.lopDays})` : ''}</span></div>
  </div>

  <!-- Earnings & Deductions -->
  <div class="pay-grid">
    <div class="pay-section">
      <div class="pay-section-header">Earnings</div>
      <table>
        ${earningsRows}
        <tr class="totals-row"><td><strong>Gross Earnings</strong></td><td class="amt">${fmt(p.grossEarnings)}</td></tr>
      </table>
    </div>
    <div class="pay-section">
      <div class="pay-section-header">Deductions</div>
      <table>
        ${deductionRows}
        <tr class="totals-row"><td><strong>Total Deductions</strong></td><td class="amt">${fmt(p.totalDeductions)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Net Pay -->
  <div class="net-pay">
    <div class="net-pay-label">Net Pay (Take Home)</div>
    <div class="net-pay-amount">${fmt(p.netPay)}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>This is a computer-generated payslip and does not require a signature.</span>
    <span>Generated on ${new Date().toLocaleDateString('en-IN')}</span>
  </div>
</div>
</body>
</html>`;
  }

  // ── WhatsApp Delivery ─────────────────────────────────────────────────────
  async sendPayslipWhatsApp(payslipId: string, employeeId: string, companyId: string, actorId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, phone: true, firstName: true, lastName: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    if (!emp.phone) throw new BadRequestException('Employee has no phone number on record');

    const payslip = await this.prisma.payslip.findFirst({ where: { id: payslipId, employeeId } });
    if (!payslip) throw new NotFoundException('Payslip not found');

    // Create delivery log entry
    const log = await this.prisma.whatsAppDeliveryLog.create({
      data: {
        employeeId,
        companyId,
        payslipId,
        phone:     emp.phone,
        status:    'QUEUED',
      },
    });

    // Fire-and-forget to WhatsApp webhook if configured
    this._dispatchWhatsApp(log.id, companyId, emp, payslip).catch(() => {});

    await this.audit.log(actorId, companyId, 'CREATE', 'WhatsAppDeliveryLog', log.id, `Payslip queued for WhatsApp delivery to ${emp.firstName} ${emp.lastName}`);
    return { queued: true, logId: log.id };
  }

  private async _dispatchWhatsApp(logId: string, companyId: string, emp: any, payslip: any) {
    // Real integration: call configured WhatsApp BSP (Twilio / Interakt / Kaleyra)
    // Reads webhook URL from company config; here we simulate success after 1s
    await new Promise(r => setTimeout(r, 1000));
    await this.prisma.whatsAppDeliveryLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), messageId: `mock-${Date.now()}` },
    }).catch(() => {});
  }

  async getWhatsAppLogs(companyId: string, employeeId?: string) {
    return this.prisma.whatsAppDeliveryLog.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── IT Declaration (proxy to TDS) ─────────────────────────────────────────
  async getMyDeclaration(employeeId: string) {
    const fy = this._currentFY();
    return this.prisma.tDSDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear: fy } },
    });
  }

  async saveMyDeclaration(employeeId: string, companyId: string, dto: any) {
    const fy = this._currentFY();
    const existing = await this.prisma.tDSDeclaration.findUnique({
      where: { employeeId_financialYear: { employeeId, financialYear: fy } },
    });
    if (existing?.isApproved) throw new BadRequestException('Declaration already approved — contact HR to modify');

    const decl = await this.prisma.tDSDeclaration.upsert({
      where:  { employeeId_financialYear: { employeeId, financialYear: fy } },
      create: { ...dto, employeeId, financialYear: fy },
      update: { ...dto },
    });
    await this.audit.log(employeeId, companyId, 'UPDATE', 'TDSDeclaration', decl.id, `Employee updated IT declaration for FY ${fy}`);
    return decl;
  }

  // ── Tax Worksheet ──────────────────────────────────────────────────────────
  async getTaxWorksheet(employeeId: string) {
    const fy  = this._currentFY();
    const now = new Date();
    const [fyStart, fyEnd] = this._fyDates(fy);

    const [payslips, declaration] = await Promise.all([
      this.prisma.payslip.findMany({
        where: { employeeId, status: { in: ['FINALIZED', 'PAID'] }, createdAt: { gte: fyStart, lt: fyEnd } },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.prisma.tDSDeclaration.findUnique({
        where: { employeeId_financialYear: { employeeId, financialYear: fy } },
      }),
    ]);

    const ytdGross    = payslips.reduce((s, p) => s + p.grossEarnings, 0);
    const ytdTDS      = payslips.reduce((s, p) => s + p.totalDeductions, 0); // approximate
    const monthsDone  = payslips.length;
    const monthsLeft  = 12 - monthsDone;

    // Very simple projection
    const avgMonthlyGross = monthsDone > 0 ? ytdGross / monthsDone : 0;
    const projectedGross  = ytdGross + avgMonthlyGross * monthsLeft;
    const stdDeduction    = declaration?.regime === 'OLD' ? 50000 : 75000;
    const deductions      = declaration ? (declaration.section80C + declaration.section80D + declaration.npsContrib80CCD1B) : 0;
    const taxableIncome   = Math.max(0, projectedGross - stdDeduction - (declaration?.regime === 'OLD' ? deductions : 0));

    return {
      financialYear:   fy,
      regime:          declaration?.regime || 'NEW',
      monthsDone,
      monthsLeft,
      ytdGross,
      projectedAnnualGross: projectedGross,
      standardDeduction:    stdDeduction,
      totalDeductions:      deductions,
      taxableIncome,
      declaration,
      payslipCount: payslips.length,
    };
  }

  // ── Reimbursements ────────────────────────────────────────────────────────
  async submitClaim(employeeId: string, companyId: string, dto: { category: string; description: string; amount: number; claimDate: string; receiptUrl?: string }) {
    if (!REIMB_CATEGORIES.includes(dto.category)) throw new BadRequestException('Invalid category');
    const claim = await this.prisma.reimbursementClaim.create({
      data: { employeeId, companyId, category: dto.category, description: dto.description, amount: dto.amount, claimDate: new Date(dto.claimDate), receiptUrl: dto.receiptUrl },
    });
    await this.audit.log(employeeId, companyId, 'CREATE', 'ReimbursementClaim', claim.id, `Reimbursement claim submitted: ₹${dto.amount} for ${dto.category}`);
    return claim;
  }

  async getMyClaims(employeeId: string) {
    return this.prisma.reimbursementClaim.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelClaim(id: string, employeeId: string) {
    const c = await this.prisma.reimbursementClaim.findFirst({ where: { id, employeeId } });
    if (!c) throw new NotFoundException('Claim not found');
    if (c.status !== 'PENDING') throw new BadRequestException('Only pending claims can be cancelled');
    return this.prisma.reimbursementClaim.update({ where: { id }, data: { status: 'REJECTED', reviewComment: 'Cancelled by employee' } });
  }

  // HR-facing reimbursement ops
  async getAllClaims(companyId: string, status?: string) {
    return this.prisma.reimbursementClaim.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewClaim(id: string, companyId: string, actorId: string, status: 'APPROVED' | 'REJECTED', comment?: string) {
    const c = await this.prisma.reimbursementClaim.findFirst({ where: { id, companyId } });
    if (!c) throw new NotFoundException('Claim not found');
    if (c.status !== 'PENDING') throw new BadRequestException('Claim already reviewed');
    const updated = await this.prisma.reimbursementClaim.update({
      where: { id },
      data: { status, reviewedBy: actorId, reviewedAt: new Date(), reviewComment: comment },
    });
    await this.audit.log(actorId, companyId, status === 'APPROVED' ? 'APPROVE' : 'UPDATE', 'ReimbursementClaim', id, `Reimbursement claim ${status.toLowerCase()}: ₹${c.amount} for ${c.category}`);
    return updated;
  }

  async markClaimPaid(id: string, companyId: string, actorId: string) {
    const c = await this.prisma.reimbursementClaim.findFirst({ where: { id, companyId, status: 'APPROVED' } });
    if (!c) throw new NotFoundException('Approved claim not found');
    return this.prisma.reimbursementClaim.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private _currentFY(): string {
    const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear();
    return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  }

  private _fyDates(fy: string): [Date, Date] {
    const [y] = fy.split('-').map(Number);
    return [new Date(y, 3, 1), new Date(y + 1, 3, 1)];
  }
}
