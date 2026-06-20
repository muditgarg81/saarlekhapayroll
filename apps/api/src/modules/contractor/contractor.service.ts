import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

// ─── TDS section rate table (FY 2024-25) ────────────────────────────────────
// rate depends on section + payee entity type; reduced/nil if PAN absent → 20%
interface TdsRule { individual: number; other: number; thresholdSingle: number; thresholdAnnual: number; label: string; }

const TDS_RULES: Record<string, TdsRule> = {
  // 194C — Payment to contractors
  '194C': { individual: 1, other: 2, thresholdSingle: 30000, thresholdAnnual: 100000, label: 'Payment to Contractors' },
  // 194J — Professional / technical fees (professional 10%, technical 2%) — use 10% default
  '194J': { individual: 10, other: 10, thresholdSingle: 30000, thresholdAnnual: 30000, label: 'Professional / Technical Fees' },
  // 194H — Commission / brokerage
  '194H': { individual: 5, other: 5, thresholdSingle: 15000, thresholdAnnual: 15000, label: 'Commission / Brokerage' },
  // 194I — Rent (plant/machinery 2%, land/building 10%) — use 10% default
  '194I': { individual: 10, other: 10, thresholdSingle: 240000, thresholdAnnual: 240000, label: 'Rent' },
  'NONE': { individual: 0, other: 0, thresholdSingle: 0, thresholdAnnual: 0, label: 'No TDS' },
};

const NO_PAN_RATE = 20; // Sec 206AA — higher rate when PAN not furnished

function quarterFromMonth(month: number): number {
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
}

function fyFromMonthYear(month: number, year: number): string {
  // Apr-Dec → year-year+1 ; Jan-Mar → year-1-year
  return month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
}

@Injectable()
export class ContractorService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Contractor profile CRUD ───────────────────────────────────────────────
  async listContractors(companyId: string, status?: string) {
    return this.prisma.contractor.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContractor(id: string, companyId: string) {
    const c = await this.prisma.contractor.findFirst({
      where: { id, companyId },
      include: {
        payments:  { orderBy: { createdAt: 'desc' }, take: 50 },
        form16As:  { orderBy: [{ financialYear: 'desc' }, { quarter: 'desc' }] },
      },
    });
    if (!c) throw new NotFoundException('Contractor not found');
    return c;
  }

  async createContractor(companyId: string, actorId: string, dto: any) {
    const code = dto.contractorCode || await this._nextCode(companyId);
    const c = await this.prisma.contractor.create({
      data: { ...dto, contractorCode: code, companyId },
    });
    await this.audit.log(actorId, companyId, 'CREATE', 'Contractor', c.id, `Contractor "${c.name}" added`);
    return c;
  }

  async updateContractor(id: string, companyId: string, actorId: string, dto: any) {
    const existing = await this.prisma.contractor.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Contractor not found');
    const c = await this.prisma.contractor.update({ where: { id }, data: dto });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Contractor', id, `Contractor "${c.name}" updated`);
    return c;
  }

  async deactivateContractor(id: string, companyId: string, actorId: string) {
    const existing = await this.prisma.contractor.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Contractor not found');
    await this.prisma.contractor.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'Contractor', id, `Contractor "${existing.name}" deactivated`);
    return { success: true };
  }

  private async _nextCode(companyId: string): Promise<string> {
    const count = await this.prisma.contractor.count({ where: { companyId } });
    return `CON-${String(count + 1).padStart(4, '0')}`;
  }

  // ── TDS computation ───────────────────────────────────────────────────────
  /**
   * Resolve effective TDS rate for a contractor + section, honouring:
   * - lower/nil deduction certificate (Sec 197)
   * - no-PAN higher rate (Sec 206AA)
   * - entity type (individual/HUF lower under 194C)
   */
  computeTds(contractor: any, section: string, grossAmount: number): { rate: number; tdsAmount: number; reason: string } {
    const rule = TDS_RULES[section] || TDS_RULES['194C'];

    // No PAN → 206AA higher rate
    if (!contractor.pan || contractor.pan.trim() === '') {
      const rate = NO_PAN_RATE;
      return { rate, tdsAmount: Math.round(grossAmount * rate / 100), reason: 'No PAN (Sec 206AA — 20%)' };
    }

    // Lower / nil deduction certificate valid?
    if (contractor.lowerTdsRate != null && contractor.lowerTdsValidTo && new Date(contractor.lowerTdsValidTo) >= new Date()) {
      const rate = contractor.lowerTdsRate;
      return { rate, tdsAmount: Math.round(grossAmount * rate / 100), reason: `Lower deduction cert ${contractor.lowerTdsCertNo || ''} (${rate}%)` };
    }

    if (section === 'NONE') return { rate: 0, tdsAmount: 0, reason: 'No TDS section' };

    const isIndividual = ['INDIVIDUAL', 'HUF'].includes(contractor.entityType);
    const rate = isIndividual ? rule.individual : rule.other;
    return { rate, tdsAmount: Math.round(grossAmount * rate / 100), reason: `${section} ${rule.label} (${rate}%)` };
  }

  /** Preview TDS for an arbitrary contractor+amount without persisting */
  async previewPayment(companyId: string, contractorId: string, section: string | undefined, grossAmount: number) {
    const contractor = await this.prisma.contractor.findFirst({ where: { id: contractorId, companyId } });
    if (!contractor) throw new NotFoundException('Contractor not found');
    const sec = section || contractor.tdsSection;
    const { rate, tdsAmount, reason } = this.computeTds(contractor, sec, grossAmount);
    return { contractorId, section: sec, grossAmount, tdsRate: rate, tdsAmount, netAmount: grossAmount - tdsAmount, reason };
  }

  // ── Contractor payrun flow ────────────────────────────────────────────────
  async listPayruns(companyId: string) {
    return this.prisma.contractorPayrun.findMany({
      where: { companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { _count: { select: { payments: true } } },
    });
  }

  async getPayrun(id: string, companyId: string) {
    const pr = await this.prisma.contractorPayrun.findFirst({
      where: { id, companyId },
      include: { payments: { include: { contractor: { select: { name: true, contractorCode: true, pan: true, entityType: true } } } } },
    });
    if (!pr) throw new NotFoundException('Contractor payrun not found');
    return pr;
  }

  /**
   * Create a contractor payrun for a month/year with line items.
   * lines: [{ contractorId, grossAmount, section?, invoiceNumber?, invoiceDate?, description?, gstAmount? }]
   */
  async createPayrun(companyId: string, actorId: string, dto: { month: number; year: number; notes?: string; lines: any[] }) {
    const existing = await this.prisma.contractorPayrun.findUnique({
      where: { companyId_month_year: { companyId, month: dto.month, year: dto.year } },
    });
    if (existing) throw new BadRequestException('A contractor payrun already exists for this period');
    if (!dto.lines?.length) throw new BadRequestException('At least one payment line is required');

    const fy = fyFromMonthYear(dto.month, dto.year);
    const quarter = quarterFromMonth(dto.month);

    const contractorIds = dto.lines.map(l => l.contractorId);
    const contractors = await this.prisma.contractor.findMany({ where: { id: { in: contractorIds }, companyId } });
    const cMap = Object.fromEntries(contractors.map(c => [c.id, c]));

    let totalGross = 0, totalTDS = 0, totalNet = 0;
    const paymentData = dto.lines.map(line => {
      const c = cMap[line.contractorId];
      if (!c) throw new BadRequestException(`Contractor ${line.contractorId} not found`);
      const sec = line.section || c.tdsSection;
      const { rate, tdsAmount } = this.computeTds(c, sec, line.grossAmount);
      const net = line.grossAmount - tdsAmount;
      totalGross += line.grossAmount; totalTDS += tdsAmount; totalNet += net;
      return {
        contractorId: c.id, companyId, financialYear: fy, quarter,
        invoiceNumber: line.invoiceNumber, invoiceDate: line.invoiceDate ? new Date(line.invoiceDate) : null,
        description: line.description,
        grossAmount: line.grossAmount, tdsSection: sec, tdsRate: rate, tdsAmount, netAmount: net,
        gstAmount: line.gstAmount || 0,
        status: 'PENDING',
      };
    });

    const payrun = await this.prisma.contractorPayrun.create({
      data: {
        companyId, month: dto.month, year: dto.year, notes: dto.notes, createdBy: actorId,
        totalContractors: dto.lines.length, totalGross, totalTDS, totalNet,
        payments: { create: paymentData },
      },
      include: { payments: true },
    });

    await this.audit.log(actorId, companyId, 'CREATE', 'ContractorPayrun', payrun.id, `Contractor payrun ${dto.month}/${dto.year}: ${dto.lines.length} payments, TDS ₹${Math.round(totalTDS)}`);
    return payrun;
  }

  async approvePayrun(id: string, companyId: string, actorId: string) {
    const pr = await this.prisma.contractorPayrun.findFirst({ where: { id, companyId } });
    if (!pr) throw new NotFoundException('Payrun not found');
    if (pr.status !== 'DRAFT' && pr.status !== 'PENDING_APPROVAL') throw new BadRequestException('Payrun cannot be approved in its current state');
    if (pr.createdBy === actorId) throw new BadRequestException('Maker-checker: approver must differ from creator');

    const updated = await this.prisma.contractorPayrun.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date(), payments: { updateMany: { where: { contractorPayrunId: id }, data: { status: 'APPROVED' } } } },
    });
    await this.audit.log(actorId, companyId, 'APPROVE', 'ContractorPayrun', id, `Contractor payrun ${pr.month}/${pr.year} approved`);
    return updated;
  }

  async markPayrunPaid(id: string, companyId: string, actorId: string, payDate?: string) {
    const pr = await this.prisma.contractorPayrun.findFirst({ where: { id, companyId } });
    if (!pr) throw new NotFoundException('Payrun not found');
    if (pr.status !== 'APPROVED') throw new BadRequestException('Only approved payruns can be marked paid');

    const when = payDate ? new Date(payDate) : new Date();
    const updated = await this.prisma.contractorPayrun.update({
      where: { id },
      data: { status: 'PAID', payDate: when, payments: { updateMany: { where: { contractorPayrunId: id }, data: { status: 'PAID', paidAt: when } } } },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'ContractorPayrun', id, `Contractor payrun ${pr.month}/${pr.year} marked PAID`);
    return updated;
  }

  async cancelPayrun(id: string, companyId: string, actorId: string) {
    const pr = await this.prisma.contractorPayrun.findFirst({ where: { id, companyId } });
    if (!pr) throw new NotFoundException('Payrun not found');
    if (pr.status === 'PAID') throw new BadRequestException('Paid payruns cannot be cancelled');
    const updated = await this.prisma.contractorPayrun.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'ContractorPayrun', id, `Contractor payrun ${pr.month}/${pr.year} cancelled`);
    return updated;
  }

  // ── Form 16A (quarterly TDS certificate) ──────────────────────────────────
  async getForm16ASummary(companyId: string, financialYear: string, quarter: number) {
    // Aggregate paid payments per contractor for the quarter
    const payments = await this.prisma.contractorPayment.findMany({
      where: { companyId, financialYear, quarter, status: 'PAID' },
      include: { contractor: { select: { id: true, name: true, contractorCode: true, pan: true, tdsSection: true } } },
    });

    const byContractor: Record<string, any> = {};
    for (const p of payments) {
      const key = p.contractorId;
      if (!byContractor[key]) byContractor[key] = { contractor: p.contractor, totalPaid: 0, totalTDS: 0, tdsSection: p.tdsSection, paymentCount: 0 };
      byContractor[key].totalPaid += p.grossAmount;
      byContractor[key].totalTDS  += p.tdsAmount;
      byContractor[key].paymentCount += 1;
    }

    // Merge existing issued certificates
    const issued = await this.prisma.contractorForm16A.findMany({ where: { companyId, financialYear, quarter } });
    const issuedMap = Object.fromEntries(issued.map(i => [i.contractorId, i]));

    return Object.values(byContractor).map((row: any) => ({
      ...row,
      certificate: issuedMap[row.contractor.id] || null,
    }));
  }

  async generateForm16A(contractorId: string, companyId: string, financialYear: string, quarter: number, actorId: string) {
    const payments = await this.prisma.contractorPayment.findMany({
      where: { contractorId, companyId, financialYear, quarter, status: 'PAID' },
    });
    if (!payments.length) throw new BadRequestException('No paid payments for this contractor in the selected quarter');

    const totalPaid = payments.reduce((s, p) => s + p.grossAmount, 0);
    const totalTDS  = payments.reduce((s, p) => s + p.tdsAmount, 0);
    const tdsSection = payments[0].tdsSection;

    const contractor = await this.prisma.contractor.findUnique({ where: { id: contractorId } });

    const form = await this.prisma.contractorForm16A.upsert({
      where:  { contractorId_financialYear_quarter: { contractorId, financialYear, quarter } },
      update: { totalPaid, totalTDS, tdsSection, status: 'ISSUED', issuedAt: new Date() },
      create: { contractorId, companyId, financialYear, quarter, totalPaid, totalTDS, tdsSection, status: 'ISSUED', issuedAt: new Date() },
    });

    await this.audit.log(actorId, companyId, 'CREATE', 'ContractorForm16A', form.id, `Form 16A issued to ${contractor?.name} Q${quarter} FY${financialYear} (TDS ₹${Math.round(totalTDS)})`);
    return form;
  }

  async markForm16AEsigned(id: string, companyId: string, actorId: string) {
    const existing = await this.prisma.contractorForm16A.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Form 16A not found');
    const f = await this.prisma.contractorForm16A.update({ where: { id }, data: { status: 'ESIGNED', eSignedAt: new Date() } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'ContractorForm16A', id, 'Form 16A eSigned');
    return f;
  }

  // ── TDS register (26Q-style) ──────────────────────────────────────────────
  async tdsRegister(companyId: string, financialYear: string, quarter?: number) {
    const payments = await this.prisma.contractorPayment.findMany({
      where: { companyId, financialYear, ...(quarter ? { quarter } : {}), status: { in: ['APPROVED', 'PAID'] } },
      include: { contractor: { select: { name: true, pan: true, contractorCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const bySection: Record<string, { gross: number; tds: number; count: number }> = {};
    for (const p of payments) {
      if (!bySection[p.tdsSection]) bySection[p.tdsSection] = { gross: 0, tds: 0, count: 0 };
      bySection[p.tdsSection].gross += p.grossAmount;
      bySection[p.tdsSection].tds   += p.tdsAmount;
      bySection[p.tdsSection].count += 1;
    }

    return {
      financialYear, quarter: quarter || 'ALL',
      totalGross: payments.reduce((s, p) => s + p.grossAmount, 0),
      totalTDS:   payments.reduce((s, p) => s + p.tdsAmount, 0),
      bySection,
      payments,
    };
  }
}
