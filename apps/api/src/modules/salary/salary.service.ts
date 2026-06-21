import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_SALARY_COMPONENTS, PT_SLABS, MAHARASHTRA_FEB_EXTRA, LWF_RATES } from '@saarlekha/shared';

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  async seedDefaultComponents(companyId: string) {
    for (const comp of DEFAULT_SALARY_COMPONENTS) {
      await this.prisma.salaryComponent.upsert({
        where: { code_companyId: { code: comp.code, companyId } },
        create: {
          name: comp.name,
          code: comp.code,
          type: comp.type,
          calculationType: comp.calculationType,
          value: comp.value,
          formula: 'formula' in comp ? (comp as any).formula : undefined,
          isTaxable: !['PF_EMPLOYEE', 'ESI_EMPLOYEE', 'PT', 'LWF'].includes(comp.code),
          isStatutory: 'isStatutory' in comp ? (comp as any).isStatutory : false,
          companyId,
        },
        update: {},
      });
    }
    return this.getComponents(companyId);
  }

  async getComponents(companyId: string) {
    return this.prisma.salaryComponent.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createComponent(companyId: string, dto: any) {
    const existing = await this.prisma.salaryComponent.findUnique({
      where: { code_companyId: { code: dto.code, companyId } },
    });
    if (existing) throw new ConflictException(`A component with code "${dto.code}" already exists`);
    return this.prisma.salaryComponent.create({ data: { ...dto, companyId } });
  }

  async updateComponent(id: string, companyId: string, dto: any) {
    const comp = await this.prisma.salaryComponent.findUnique({ where: { id } });
    if (!comp || comp.companyId !== companyId) throw new NotFoundException('Component not found');
    return this.prisma.salaryComponent.update({ where: { id }, data: dto });
  }

  async deactivateComponent(id: string, companyId: string) {
    const comp = await this.prisma.salaryComponent.findUnique({ where: { id } });
    if (!comp || comp.companyId !== companyId) throw new NotFoundException('Component not found');
    if (comp.isStatutory) throw new ConflictException('Statutory components cannot be deactivated');
    return this.prisma.salaryComponent.update({ where: { id }, data: { isActive: false } });
  }

  async getStructures(companyId: string) {
    return this.prisma.salaryStructure.findMany({
      where: { companyId, isActive: true },
      include: { components: { include: { component: true }, orderBy: { order: 'asc' } } },
    });
  }

  async createStructure(companyId: string, dto: { name: string; description?: string; componentIds: string[] }) {
    const existing = await this.prisma.salaryStructure.findUnique({
      where: { name_companyId: { name: dto.name, companyId } },
    });
    if (existing) throw new ConflictException(`A structure named "${dto.name}" already exists`);

    return this.prisma.salaryStructure.create({
      data: {
        name: dto.name,
        description: dto.description,
        companyId,
        components: {
          create: dto.componentIds.map((componentId, order) => ({ componentId, order })),
        },
      },
      include: { components: { include: { component: true }, orderBy: { order: 'asc' } } },
    });
  }

  async updateStructure(id: string, companyId: string, dto: any) {
    const s = await this.prisma.salaryStructure.findUnique({ where: { id } });
    if (!s || s.companyId !== companyId) throw new NotFoundException('Structure not found');

    if (dto.componentIds) {
      await this.prisma.salaryStructureComponent.deleteMany({ where: { salaryStructureId: id } });
      await this.prisma.salaryStructureComponent.createMany({
        data: dto.componentIds.map((componentId: string, order: number) => ({ salaryStructureId: id, componentId, order })),
      });
    }

    return this.prisma.salaryStructure.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: { components: { include: { component: true }, orderBy: { order: 'asc' } } },
    });
  }

  async deactivateStructure(id: string, companyId: string) {
    const s = await this.prisma.salaryStructure.findUnique({ where: { id } });
    if (!s || s.companyId !== companyId) throw new NotFoundException('Structure not found');
    const inUse = await this.prisma.employee.count({ where: { salaryStructureId: id, status: 'ACTIVE' } });
    if (inUse > 0) throw new ConflictException(`Cannot remove: ${inUse} active employee(s) use this structure`);
    return this.prisma.salaryStructure.update({ where: { id }, data: { isActive: false } });
  }

  // ── Statutory helpers ─────────────────────────────────────────────────────
  /** Professional Tax for a state at a given monthly gross (Maharashtra Feb +₹100 rule). */
  private calcPT(state: string | undefined, monthlyGross: number, month?: number): number {
    if (!state) return 0;
    const slabs = PT_SLABS[state];
    if (!slabs || slabs.length === 0) return 0;
    const slab = slabs.find(s => monthlyGross <= s.upTo);
    let tax = slab ? slab.tax : slabs[slabs.length - 1].tax;
    if (state === 'Maharashtra' && month === 2 && tax === 200) tax += MAHARASHTRA_FEB_EXTRA;
    return tax;
  }

  /** Labour Welfare Fund employee contribution + its deduction frequency for a state. */
  private calcLWF(state: string | undefined, month?: number): { amount: number; frequency: string; applies: boolean } {
    if (!state) return { amount: 0, frequency: '', applies: false };
    const r = LWF_RATES[state];
    if (!r) return { amount: 0, frequency: '', applies: false };
    let applies = true;
    if (month) {
      if (r.frequency === 'JUNE_DEC') applies = month === 6 || month === 12;
      else if (r.frequency === 'ANNUAL') applies = month === 12;
    }
    return { amount: r.employee, frequency: r.frequency, applies };
  }

  // ── Salary Simulator ──────────────────────────────────────────────────────
  async simulate(companyId: string, dto: { structureId: string; ctc: number; state?: string; month?: number }) {
    const structure = await this.prisma.salaryStructure.findUnique({
      where: { id: dto.structureId },
      include: { components: { include: { component: true }, orderBy: { order: 'asc' } } },
    });
    if (!structure || structure.companyId !== companyId) throw new NotFoundException('Structure not found');

    // Default the state to the company's registered state when not supplied.
    let state = dto.state;
    if (!state) {
      const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { state: true } });
      state = company?.state;
    }

    const monthlyCTC = dto.ctc / 12;
    const context: Record<string, number> = { CTC: dto.ctc, MONTHLY_CTC: monthlyCTC };

    const earnings: { code: string; name: string; amount: number; calculationType: string }[] = [];
    const deductions: { code: string; name: string; amount: number; calculationType: string; isStatutory: boolean }[] = [];

    // Resolve earnings first (in order)
    for (const sc of structure.components) {
      const comp = sc.component;
      if (comp.type !== 'EARNING') continue;

      // Calculate PF_EMPLOYER dynamically if BASIC is resolved and PF_EMPLOYER is not set yet
      if (context['BASIC'] && !context['PF_EMPLOYER']) {
        const basic = context['BASIC'];
        const pfWage = Math.min(basic, 15000);
        context['PF_EMPLOYER'] = Math.round(pfWage * 0.1367);
        context['PF_EMPLOYEE'] = Math.round(pfWage * 0.12);
      }

      const amount = Math.round(this.resolve(comp, context, monthlyCTC));
      context[comp.code] = amount;
      earnings.push({ code: comp.code, name: comp.name, amount, calculationType: comp.calculationType });
    }

    const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    context['GROSS'] = grossEarnings;

    // Estimate statutory deductions
    const basic = context['BASIC'] || 0;
    const pfWage = Math.min(basic, 15000);
    if (context['PF_EMPLOYEE'] === undefined) {
      context['PF_EMPLOYEE'] = Math.round(pfWage * 0.12);
      context['PF_EMPLOYER'] = Math.round(pfWage * 0.1367); // EPF 3.67% + EPS 8.33% + EDLI 0.5% + admin
    }
    context['ESI_EMPLOYEE'] = grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
    // State-driven statutory taxes
    context['PT'] = this.calcPT(state, grossEarnings, dto.month);
    const lwf = this.calcLWF(state, dto.month);
    context['LWF'] = dto.month ? (lwf.applies ? lwf.amount : 0) : lwf.amount;
    context['TDS'] = 0;  // requires full-year income projection

    // Resolve non-statutory deductions
    for (const sc of structure.components) {
      const comp = sc.component;
      if (comp.type !== 'DEDUCTION') continue;
      const amount = context[comp.code] ?? Math.round(this.resolve(comp, context, monthlyCTC));
      context[comp.code] = amount;
      deductions.push({ code: comp.code, name: comp.name, amount, calculationType: comp.calculationType, isStatutory: comp.isStatutory });
    }

    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

    const freqLabel = lwf.frequency === 'MONTHLY' ? 'monthly' : lwf.frequency === 'JUNE_DEC' ? 'in Jun & Dec' : lwf.frequency === 'ANNUAL' ? 'annually' : '';
    const notes: string[] = [];
    if (state) {
      const ptApplicable = PT_SLABS[state] && PT_SLABS[state].length > 0;
      notes.push(ptApplicable
        ? `PT computed for ${state}${state === 'Maharashtra' && dto.month === 2 ? ' (Feb ₹300 rule applied)' : ''}`
        : `${state} does not levy Professional Tax`);
      if (LWF_RATES[state]) {
        notes.push(`LWF ₹${LWF_RATES[state].employee} (employee) deducted ${freqLabel} in ${state}` + (dto.month && !lwf.applies ? ' — not due in the selected month' : ''));
      }
    } else {
      notes.push('Select a state to compute PT & LWF');
    }
    notes.push('TDS requires full-year projection', 'ESI waived for gross > ₹21,000/month');

    return {
      ctc: dto.ctc,
      monthly: monthlyCTC,
      state,
      month: dto.month ?? null,
      earnings,
      deductions,
      grossEarnings,
      totalDeductions,
      netPay: Math.max(grossEarnings - totalDeductions, 0),
      notes,
    };
  }

  private resolve(
    comp: { calculationType: string; value: number; formula?: string | null },
    ctx: Record<string, number>,
    monthlyCTC: number,
  ): number {
    switch (comp.calculationType) {
      case 'FIXED': return comp.value;
      case 'PERCENTAGE_OF_CTC': return (monthlyCTC * comp.value) / 100;
      case 'PERCENTAGE_OF_BASIC': return ((ctx['BASIC'] || 0) * comp.value) / 100;
      case 'PERCENTAGE_OF_GROSS': return ((ctx['GROSS'] || 0) * comp.value) / 100;
      case 'FORMULA': return this.evalFormula(comp.formula || '0', ctx);
      default: return 0;
    }
  }

  private evalFormula(formula: string, ctx: Record<string, number>): number {
    try {
      let expr = formula;
      for (const [key, val] of Object.entries(ctx)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
      }
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        return Function('"use strict"; return (' + expr + ')')() as number;
      }
      return 0;
    } catch { return 0; }
  }
}
