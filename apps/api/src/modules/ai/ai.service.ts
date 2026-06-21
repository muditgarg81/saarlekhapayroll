import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const NOT_CONFIGURED = 'AI is not configured. Set GEMINI_API_KEY in the API environment to enable AI features.';

@Injectable()
export class AiService {
  private client: GoogleGenAI | null = null;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') || this.config.get<string>('GOOGLE_API_KEY');
    this.model = this.config.get<string>('AI_MODEL') || DEFAULT_MODEL;
    if (apiKey) this.client = new GoogleGenAI({ apiKey });
  }

  isConfigured() {
    return { configured: !!this.client, model: this.model, provider: 'gemini' };
  }

  // ── Low-level LLM helper ──────────────────────────────────────────────────
  private async _ask(system: string, userText: string, maxTokens = 1024): Promise<string> {
    if (!this.client) throw new BadRequestException(NOT_CONFIGURED);
    const resp = await this.client.models.generateContent({
      model: this.model,
      contents: userText,
      config: { systemInstruction: system, maxOutputTokens: maxTokens },
    });
    return (resp.text ?? '').trim();
  }

  private fmt(n: number) { return `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`; }

  // ── Context pack: compact snapshot of company payroll for grounding ────────
  private async _buildContext(companyId: string) {
    const now = new Date();
    const [company, headcount, deptGroups, recentPayruns] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true, state: true, payrollCycle: true } }),
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: { companyId, status: 'ACTIVE' }, _count: { _all: true }, _sum: { ctc: true } }),
      this.prisma.payrun.findMany({
        where: { companyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 6,
        select: { month: true, year: true, type: true, status: true, totalEmployees: true, totalGross: true, totalDeductions: true, totalNetPay: true },
      }),
    ]);

    const depts = await this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true } });
    const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));

    const M = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lines: string[] = [];
    lines.push(`Company: ${company?.name} (state: ${company?.state}, cycle: ${company?.payrollCycle})`);
    lines.push(`Active employees: ${headcount}`);
    lines.push(`Today: ${now.toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('Department headcount & monthly CTC:');
    for (const g of deptGroups) {
      lines.push(`- ${deptMap[g.departmentId] || 'Unassigned'}: ${g._count._all} employees, total annual CTC ${this.fmt(g._sum.ctc || 0)}`);
    }
    lines.push('');
    lines.push('Recent payruns:');
    for (const p of recentPayruns) {
      lines.push(`- ${M[p.month]} ${p.year} [${p.type}/${p.status}]: ${p.totalEmployees} emp, gross ${this.fmt(p.totalGross)}, deductions ${this.fmt(p.totalDeductions)}, net ${this.fmt(p.totalNetPay)}`);
    }
    return lines.join('\n');
  }

  // ── 1. Natural-language payroll queries ────────────────────────────────────
  async query(companyId: string, actorId: string, question: string) {
    if (!question?.trim()) throw new BadRequestException('Question is required');
    const context = await this._buildContext(companyId);
    const system = [
      'You are a payroll analytics assistant for an Indian payroll system (Saarlekha Payroll).',
      'Answer the user\'s question using ONLY the data snapshot provided. ',
      'If the snapshot lacks the data needed, say what is missing and suggest which report to run.',
      'Use Indian number formatting (₹, lakhs/crores where natural). Be concise — a few sentences or a short list.',
      'Never invent figures not present in the data.',
      '',
      '=== COMPANY PAYROLL DATA SNAPSHOT ===',
      context,
    ].join('\n');

    const answer = await this._ask(system, question, 900);
    await this.audit.log(actorId, companyId, 'EXPORT', 'AiQuery', null, `AI query: ${question.slice(0, 120)}`);
    return { question, answer, model: this.model };
  }

  // ── 2. Anomaly detection (salary spikes) — deterministic ───────────────────
  /**
   * Compares each employee's net pay in the target month against their own
   * trailing average (previous up to 3 months). Flags spikes/drops beyond threshold,
   * plus new-payee and large-deduction-change cases.
   */
  async detectAnomalies(companyId: string, month: number, year: number, thresholdPct = 25) {
    const target = await this.prisma.payrun.findFirst({
      where: { companyId, month, year, type: 'REGULAR' },
      include: { payslips: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } } } },
    });
    if (!target) return { found: false, month, year, anomalies: [], summary: 'No regular payrun found for this period.' };

    // gather prior 3 months of payslips per employee
    const priorKeys: { m: number; y: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      let m = month - i, y = year;
      while (m <= 0) { m += 12; y -= 1; }
      priorKeys.push({ m, y });
    }
    const priorPayslips = await this.prisma.payslip.findMany({
      where: {
        payrun: { companyId, type: 'REGULAR', OR: priorKeys.map(k => ({ month: k.m, year: k.y })) },
      },
      select: { employeeId: true, netPay: true, grossEarnings: true, totalDeductions: true },
    });

    const priorByEmp: Record<string, { net: number[]; ded: number[] }> = {};
    for (const p of priorPayslips) {
      if (!priorByEmp[p.employeeId]) priorByEmp[p.employeeId] = { net: [], ded: [] };
      priorByEmp[p.employeeId].net.push(p.netPay);
      priorByEmp[p.employeeId].ded.push(p.totalDeductions);
    }

    const anomalies: any[] = [];
    for (const slip of target.payslips) {
      const id = slip.employee.id;
      const name = `${slip.employee.firstName} ${slip.employee.lastName}`;
      const prior = priorByEmp[id];

      if (!prior || prior.net.length === 0) {
        anomalies.push({ employeeCode: slip.employee.employeeCode, name, type: 'NEW_PAYEE', severity: 'info',
          detail: `First payslip in trailing window — net ${this.fmt(slip.netPay)}`, current: slip.netPay, baseline: null, changePct: null });
        continue;
      }

      const avgNet = prior.net.reduce((a, b) => a + b, 0) / prior.net.length;
      const changePct = avgNet > 0 ? ((slip.netPay - avgNet) / avgNet) * 100 : 0;

      if (Math.abs(changePct) >= thresholdPct) {
        anomalies.push({
          employeeCode: slip.employee.employeeCode, name,
          type: changePct > 0 ? 'SALARY_SPIKE' : 'SALARY_DROP',
          severity: Math.abs(changePct) >= 50 ? 'high' : 'medium',
          detail: `Net pay ${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(1)}% vs ${prior.net.length}-month avg (${this.fmt(avgNet)} → ${this.fmt(slip.netPay)})`,
          current: Math.round(slip.netPay), baseline: Math.round(avgNet), changePct: +changePct.toFixed(1),
        });
      }

      // deduction anomaly
      const avgDed = prior.ded.reduce((a, b) => a + b, 0) / prior.ded.length;
      const dedChange = avgDed > 0 ? ((slip.totalDeductions - avgDed) / avgDed) * 100 : 0;
      if (Math.abs(dedChange) >= 40 && Math.abs(slip.totalDeductions - avgDed) > 2000) {
        anomalies.push({
          employeeCode: slip.employee.employeeCode, name, type: 'DEDUCTION_CHANGE', severity: 'medium',
          detail: `Deductions changed ${dedChange.toFixed(1)}% (${this.fmt(avgDed)} → ${this.fmt(slip.totalDeductions)})`,
          current: Math.round(slip.totalDeductions), baseline: Math.round(avgDed), changePct: +dedChange.toFixed(1),
        });
      }
    }

    // sort by severity then magnitude
    const sevRank: Record<string, number> = { high: 0, medium: 1, info: 2 };
    anomalies.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || (Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0)));

    const high = anomalies.filter(a => a.severity === 'high').length;
    const summary = anomalies.length === 0
      ? 'No significant anomalies detected.'
      : `${anomalies.length} item(s) flagged${high ? `, ${high} high-severity` : ''}. Review before approving the payrun.`;

    return { found: true, month, year, thresholdPct, count: anomalies.length, anomalies, summary };
  }

  /** Optional: ask the LLM to narrate the anomaly findings for a manager. */
  async explainAnomalies(companyId: string, actorId: string, month: number, year: number) {
    const result = await this.detectAnomalies(companyId, month, year);
    if (!result.found || result.count === 0) return { ...result, narrative: result.summary };
    const system = 'You are a payroll auditor. Given a list of detected payroll anomalies, write a brief (3-5 sentence) plain-English risk summary for an HR manager, prioritising what to check first. Do not invent data.';
    const narrative = await this._ask(system, JSON.stringify(result.anomalies), 500);
    await this.audit.log(actorId, companyId, 'EXPORT', 'AiAnomaly', null, `AI anomaly explanation ${month}/${year}`);
    return { ...result, narrative };
  }

  // ── 3. Tax optimization suggestions — deterministic ────────────────────────
  async taxOptimization(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, firstName: true, lastName: true, ctc: true },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const now = new Date();
    const fy = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}` : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
    const decl = await this.prisma.tDSDeclaration.findUnique({ where: { employeeId_financialYear: { employeeId, financialYear: fy } } });

    const annualGross = employee.ctc;
    const suggestions: { title: string; detail: string; potentialSaving: number; section: string }[] = [];

    // marginal rate estimate (rough, old regime slabs)
    const taxable = Math.max(0, annualGross - 50000);
    const marginal = taxable > 1500000 ? 0.30 : taxable > 1000000 ? 0.30 : taxable > 750000 ? 0.20 : taxable > 500000 ? 0.20 : taxable > 250000 ? 0.05 : 0;
    const cess = 1.04;

    const sec80C = decl?.section80C ?? 0;
    const epf = decl?.epfContribution ?? 0;
    const used80C = sec80C + epf + (decl?.ppfContribution ?? 0) + (decl?.elssInvestment ?? 0) + (decl?.lifeInsurance ?? 0);
    const head80C = Math.max(0, 150000 - used80C);
    if (head80C > 0) {
      suggestions.push({ section: '80C', title: `Invest ₹${head80C.toLocaleString('en-IN')} more under 80C`,
        detail: 'ELSS, PPF, life insurance, or tax-saver FD. EPF already counts toward this limit.',
        potentialSaving: Math.round(head80C * marginal * cess) });
    }

    const nps = decl?.npsContrib80CCD1B ?? 0;
    const headNps = Math.max(0, 50000 - nps);
    if (headNps > 0) {
      suggestions.push({ section: '80CCD(1B)', title: `Contribute ₹${headNps.toLocaleString('en-IN')} to NPS`,
        detail: 'Additional ₹50,000 deduction over and above 80C, exclusive to NPS Tier-I.',
        potentialSaving: Math.round(headNps * marginal * cess) });
    }

    const sec80D = decl?.section80D ?? 0;
    const head80D = Math.max(0, 25000 - sec80D);
    if (head80D > 0) {
      suggestions.push({ section: '80D', title: `Claim up to ₹${head80D.toLocaleString('en-IN')} health insurance premium`,
        detail: 'Medical insurance for self/family (₹25k; ₹50k if senior-citizen parents).',
        potentialSaving: Math.round(head80D * marginal * cess) });
    }

    if (!decl?.hraExemption && annualGross > 600000) {
      suggestions.push({ section: 'HRA', title: 'Submit rent receipts to claim HRA exemption',
        detail: 'If you pay rent, HRA exemption can significantly reduce taxable income (old regime).',
        potentialSaving: 0 });
    }

    // regime guidance
    const regimeNote = used80C + nps + sec80D > 200000
      ? 'You have substantial deductions — the OLD regime likely benefits you. Verify in the TDS computation.'
      : 'With limited deductions, the NEW regime (std deduction ₹75k, lower slabs) may be better. Compare both in the TDS computation.';

    const totalPotential = suggestions.reduce((s, x) => s + x.potentialSaving, 0);
    return {
      employee: { id: employee.id, name: `${employee.firstName} ${employee.lastName}` },
      financialYear: fy, annualGross, currentRegime: decl?.regime || 'NEW',
      estimatedMarginalRate: `${Math.round(marginal * 100)}%`,
      suggestions, totalPotentialSaving: totalPotential, regimeNote,
      hasDeclaration: !!decl,
    };
  }

  // ── 4. Employee FAQ chatbot ────────────────────────────────────────────────
  async chat(companyId: string, employeeId: string | null, history: { role: 'user' | 'assistant'; content: string }[]) {
    if (!this.client) throw new BadRequestException(NOT_CONFIGURED);
    if (!history?.length) throw new BadRequestException('No message provided');

    // ground with the employee's own snapshot (if linked)
    let personal = '';
    if (employeeId) {
      const now = new Date();
      const fy = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}` : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
      const [emp, lastSlip, balances] = await Promise.all([
        this.prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, designation: true, ctc: true } }),
        this.prisma.payslip.findFirst({ where: { employeeId, status: { in: ['FINALIZED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], select: { month: true, year: true, netPay: true } }),
        this.prisma.leaveBalance.findMany({ where: { employeeId, financialYear: fy }, include: { policy: { select: { name: true } } } }),
      ]);
      if (emp) {
        const bal = balances.map(b => `${b.policy?.name}: ${(b.allocated + b.carryForward - b.taken - b.pending - b.encashed).toFixed(1)} days`).join(', ');
        personal = [
          `The employee asking: ${emp.firstName}, ${emp.designation}, annual CTC ${this.fmt(emp.ctc)}.`,
          lastSlip ? `Last payslip: ${lastSlip.month}/${lastSlip.year}, net ${this.fmt(lastSlip.netPay)}.` : 'No payslip yet.',
          bal ? `Leave balances (FY ${fy}): ${bal}.` : '',
        ].join(' ');
      }
    }

    const system = [
      'You are the Saarlekha Payroll employee help assistant for an Indian company.',
      'Answer employee FAQs about payslips, salary structure, PF/ESI/PT, TDS, tax regimes, leave, reimbursements, and HR processes.',
      'Be friendly, concise, and accurate to Indian payroll rules. For India tax/statutory specifics, give general guidance and suggest the employee verify with HR or the in-app TDS computation.',
      'Only use the personal data provided below to answer questions about the employee\'s own figures; never fabricate amounts.',
      personal ? `\nEmployee context: ${personal}` : '\nNo personal data is linked to this user.',
    ].join('\n');

    // Gemini multi-turn: roles are 'user' and 'model'; history must start with a user turn.
    const contents = history
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    while (contents.length && contents[0].role !== 'user') contents.shift();

    const resp = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: { systemInstruction: system, maxOutputTokens: 800 },
    });
    const reply = (resp.text ?? '').trim();
    return { reply, model: this.model };
  }
}
