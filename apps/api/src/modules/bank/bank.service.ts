import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

// Bank name → IFSC prefix mapping (first 4 chars identify the bank)
const BANK_BY_IFSC: Record<string, string> = {
  HDFC: 'HDFC Bank', SBIN: 'State Bank of India', ICIC: 'ICICI Bank',
  AXIS: 'Axis Bank', KKBK: 'Kotak Mahindra Bank', PUNB: 'Punjab National Bank',
  UBIN: 'Union Bank of India', CNRB: 'Canara Bank', BARB: 'Bank of Baroda',
  IOBA: 'Indian Overseas Bank', IDIB: 'Indian Bank', BKID: 'Bank of India',
  CITI: 'Citibank', YESB: 'Yes Bank', INDB: 'Indusind Bank', RATN: 'RBL Bank',
  FDRL: 'Federal Bank', KARB: 'Karnataka Bank', KVBL: 'Karur Vysya Bank',
  TMBL: 'Tamilnad Mercantile Bank',
};

function bankFromIfsc(ifsc: string): string {
  if (!ifsc) return 'Unknown Bank';
  const prefix = ifsc.slice(0, 4).toUpperCase();
  return BANK_BY_IFSC[prefix] || `Bank (${prefix})`;
}

function nextAdviceNo(existing: number): string {
  return `BA-${String(existing + 1).padStart(5, '0')}`;
}

// Generate NEFT / IMPS advice file content (NACH-compatible flat format)
function generateAdviceFile(advice: any, transactions: any[]): string {
  const lines: string[] = [];
  // Header record
  lines.push([
    'H',                                     // Record type
    advice.adviceNo,                         // Advice number
    new Date().toISOString().slice(0, 10).replace(/-/g, ''), // Date YYYYMMDD
    advice.mode,                             // Payment mode
    String(transactions.length).padStart(6, '0'),
    String(Math.round(advice.totalAmount)).padStart(15, '0'),
  ].join('|'));

  // Detail records
  for (const tx of transactions) {
    lines.push([
      'D',
      tx.employeeCode.padEnd(10),
      tx.employeeName.padEnd(40),
      tx.accountNumber.padEnd(20),
      tx.ifscCode.padEnd(11),
      tx.accountType.slice(0, 2).toUpperCase().padEnd(2),
      String(Math.round(tx.amount)).padStart(13, '0'),
      tx.mode,
      (tx.employeeCode + '-SAL').padEnd(22), // Narration
    ].join('|'));
  }

  // Trailer
  lines.push([
    'T',
    String(transactions.length).padStart(6, '0'),
    String(Math.round(advice.totalAmount)).padStart(15, '0'),
  ].join('|'));

  return lines.join('\n');
}

@Injectable()
export class BankService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Generate bank advice from approved payrun ─────────────
  async generateAdvice(payrunId: string, companyId: string, actorId: string, dto: { mode?: string; bankName?: string; accountNo?: string; ifscCode?: string }) {
    const payrun = await this.prisma.payrun.findFirst({
      where:   { id: payrunId, companyId },
      include: {
        payslips: {
          where: { netPay: { gt: 0 } },
          include: {
            employee: {
              select: { id: true, employeeCode: true, firstName: true, lastName: true, bankName: true, accountNumber: true, ifscCode: true, accountType: true },
            },
          },
        },
      },
    });

    if (!payrun) throw new NotFoundException('Payrun not found');
    if (!['APPROVED', 'PAID'].includes(payrun.status)) {
      throw new BadRequestException('Payrun must be APPROVED before generating bank advice');
    }

    // Count existing advices for sequence number
    const existingCount = await this.prisma.bankAdvice.count({ where: { companyId } });
    const adviceNo = nextAdviceNo(existingCount);
    const mode     = dto.mode || 'NEFT';

    const advice = await this.prisma.bankAdvice.create({
      data: {
        companyId,
        payrunId,
        adviceNo,
        bankName:      dto.bankName  || 'Company Bank',
        ifscCode:      dto.ifscCode  || null,
        accountNo:     dto.accountNo || null,
        mode,
        totalAmount:   payrun.totalNetPay,
        employeeCount: payrun.payslips.length,
        status:        'GENERATED',
        createdBy:     actorId,
        transactions: {
          create: payrun.payslips.map(ps => ({
            employeeId:    ps.employee.id,
            employeeCode:  ps.employee.employeeCode,
            employeeName:  `${ps.employee.firstName} ${ps.employee.lastName}`,
            bankName:      bankFromIfsc(ps.employee.ifscCode),
            accountNumber: ps.employee.accountNumber,
            ifscCode:      ps.employee.ifscCode,
            accountType:   ps.employee.accountType,
            amount:        ps.netPay,
            mode,
            status:        'PENDING',
          })),
        },
      },
      include: { transactions: true },
    });

    await this.audit.log(actorId, companyId, 'CREATE', 'BankAdvice', advice.id,
      `Bank advice ${adviceNo} generated for payrun ${payrunId} — ${payrun.payslips.length} employees, ${fmt(payrun.totalNetPay)}`);

    return advice;
  }

  // ── List advices ──────────────────────────────────────────
  async listAdvices(companyId: string, filters: { status?: string; payrunId?: string }) {
    return this.prisma.bankAdvice.findMany({
      where: { companyId, ...(filters.status ? { status: filters.status } : {}), ...(filters.payrunId ? { payrunId: filters.payrunId } : {}) },
      include: { payrun: { select: { month: true, year: true, type: true } }, _count: { select: { transactions: true } } },
      orderBy: { generatedAt: 'desc' },
    });
  }

  // ── Get advice detail ─────────────────────────────────────
  async getAdvice(id: string, companyId: string) {
    const advice = await this.prisma.bankAdvice.findFirst({
      where:   { id, companyId },
      include: {
        payrun:       { select: { month: true, year: true, type: true, status: true } },
        transactions: { orderBy: { employeeCode: 'asc' } },
      },
    });
    if (!advice) throw new NotFoundException('Bank advice not found');
    return advice;
  }

  // ── Download advice file (NEFT/IMPS flat file) ───────────
  async getAdviceFile(id: string, companyId: string): Promise<{ filename: string; content: string; mimeType: string }> {
    const advice = await this.getAdvice(id, companyId);
    const content = generateAdviceFile(advice, advice.transactions);
    return {
      filename: `${advice.adviceNo}_${advice.mode}.txt`,
      content,
      mimeType: 'text/plain',
    };
  }

  // ── Mark advice as uploaded ───────────────────────────────
  async markUploaded(id: string, companyId: string, actorId: string) {
    const advice = await this._findAdvice(id, companyId);
    if (advice.status !== 'GENERATED') throw new BadRequestException('Advice must be in GENERATED status');
    const updated = await this.prisma.bankAdvice.update({
      where: { id },
      data:  { status: 'UPLOADED', uploadedAt: new Date() },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'BankAdvice', id, `Bank advice ${advice.adviceNo} marked as uploaded`);
    return updated;
  }

  // ── Update transaction status (UTR upload / manual entry) ─
  async updateTransactionStatus(
    adviceId: string,
    txId: string,
    companyId: string,
    actorId: string,
    dto: { status: string; utr?: string; failureReason?: string },
  ) {
    const advice = await this._findAdvice(adviceId, companyId);
    const tx = await this.prisma.bankTransaction.findFirst({ where: { id: txId, adviceId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    const updated = await this.prisma.bankTransaction.update({
      where: { id: txId },
      data:  { status: dto.status, utr: dto.utr || null, failureReason: dto.failureReason || null, processedAt: new Date() },
    });

    // Recalculate advice status
    await this._syncAdviceStatus(adviceId, actorId, companyId, advice.adviceNo);
    return updated;
  }

  // ── Bulk UTR upload (parse CSV: employeeCode,utr,status) ──
  async bulkUpdateUTR(adviceId: string, companyId: string, actorId: string, csvContent: string) {
    const advice = await this._findAdvice(adviceId, companyId);
    const lines  = csvContent.trim().split('\n').slice(1); // skip header
    const results: any[] = [];

    for (const line of lines) {
      const [employeeCode, utr, status = 'SUCCESS', failureReason = ''] = line.split(',').map(s => s.trim());
      if (!employeeCode) continue;

      const tx = await this.prisma.bankTransaction.findFirst({ where: { adviceId, employeeCode } });
      if (!tx) { results.push({ employeeCode, error: 'Not found in advice' }); continue; }

      await this.prisma.bankTransaction.update({
        where: { id: tx.id },
        data:  { status, utr: utr || null, failureReason: failureReason || null, processedAt: new Date() },
      });
      results.push({ employeeCode, status, utr });
    }

    await this._syncAdviceStatus(adviceId, actorId, companyId, advice.adviceNo);
    return { processed: results.length, results };
  }

  // ── Bank-wise summary (multi-bank breakdown) ──────────────
  async bankWiseSummary(adviceId: string, companyId: string) {
    const advice = await this.getAdvice(adviceId, companyId);
    const byBank: Record<string, { bank: string; count: number; amount: number; statuses: string[] }> = {};

    for (const tx of advice.transactions) {
      if (!byBank[tx.bankName]) byBank[tx.bankName] = { bank: tx.bankName, count: 0, amount: 0, statuses: [] };
      byBank[tx.bankName].count++;
      byBank[tx.bankName].amount += tx.amount;
      byBank[tx.bankName].statuses.push(tx.status);
    }

    return Object.values(byBank).map(b => ({
      ...b,
      amount:         Math.round(b.amount),
      successCount:   b.statuses.filter(s => s === 'SUCCESS').length,
      pendingCount:   b.statuses.filter(s => s === 'PENDING').length,
      failedCount:    b.statuses.filter(s => s === 'FAILED').length,
    })).sort((a, b) => b.amount - a.amount);
  }

  // ── Payment summary for a payrun ─────────────────────────
  async payrunPaymentSummary(payrunId: string, companyId: string) {
    const advices = await this.prisma.bankAdvice.findMany({
      where:   { payrunId, companyId },
      include: { transactions: { select: { status: true, amount: true } } },
    });

    const txAll   = advices.flatMap(a => a.transactions);
    const total   = txAll.reduce((s, t) => s + t.amount, 0);
    const success = txAll.filter(t => t.status === 'SUCCESS').reduce((s, t) => s + t.amount, 0);
    const failed  = txAll.filter(t => t.status === 'FAILED').reduce((s, t) => s + t.amount, 0);
    const pending = txAll.filter(t => t.status === 'PENDING').reduce((s, t) => s + t.amount, 0);

    return {
      payrunId, adviceCount: advices.length,
      totalAmount: Math.round(total),
      successAmount: Math.round(success), successCount: txAll.filter(t => t.status === 'SUCCESS').length,
      failedAmount:  Math.round(failed),  failedCount:  txAll.filter(t => t.status === 'FAILED').length,
      pendingAmount: Math.round(pending), pendingCount: txAll.filter(t => t.status === 'PENDING').length,
    };
  }

  // ── Private ───────────────────────────────────────────────
  private async _findAdvice(id: string, companyId: string) {
    const a = await this.prisma.bankAdvice.findFirst({ where: { id, companyId } });
    if (!a) throw new NotFoundException('Bank advice not found');
    return a;
  }

  private async _syncAdviceStatus(adviceId: string, actorId: string, companyId: string, adviceNo: string) {
    const txs = await this.prisma.bankTransaction.findMany({ where: { adviceId }, select: { status: true } });
    const statuses = txs.map(t => t.status);
    let adviceStatus: string;
    if (statuses.every(s => s === 'SUCCESS'))        adviceStatus = 'COMPLETED';
    else if (statuses.every(s => s === 'PENDING'))   adviceStatus = 'UPLOADED';
    else if (statuses.some(s => s === 'FAILED') && statuses.some(s => s === 'SUCCESS')) adviceStatus = 'PARTIALLY_PAID';
    else if (statuses.some(s => s === 'FAILED'))     adviceStatus = 'FAILED';
    else                                             adviceStatus = 'PROCESSING';

    await this.prisma.bankAdvice.update({
      where: { id: adviceId },
      data:  { status: adviceStatus, ...(adviceStatus === 'COMPLETED' ? { processedAt: new Date() } : {}) },
    });

    if (adviceStatus === 'COMPLETED') {
      await this.audit.log(actorId, companyId, 'UPDATE', 'BankAdvice', adviceId, `Bank advice ${adviceNo} completed — all transactions successful`);
    }
  }
}

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }
