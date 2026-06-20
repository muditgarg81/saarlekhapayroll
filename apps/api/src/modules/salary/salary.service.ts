import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_SALARY_COMPONENTS } from '@saarlekha/shared';

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

  // ── Salary Simulator ──────────────────────────────────────────────────────
  async simulate(companyId: string, dto: { structureId: string; ctc: number }) {
    const structure = await this.prisma.salaryStructure.findUnique({
      where: { id: dto.structureId },
      include: { components: { include: { component: true }, orderBy: { order: 'asc' } } },
    });
    if (!structure || structure.companyId !== companyId) throw new NotFoundException('Structure not found');

    const monthlyCTC = dto.ctc / 12;
    const context: Record<string, number> = { CTC: dto.ctc, MONTHLY_CTC: monthlyCTC };

    const earnings: { code: string; name: string; amount: number; calculationType: string }[] = [];
    const deductions: { code: string; name: string; amount: number; calculationType: string; isStatutory: boolean }[] = [];

    // Resolve earnings first (in order)
    for (const sc of structure.components) {
      const comp = sc.component;
      if (comp.type !== 'EARNING') continue;
      const amount = Math.round(this.resolve(comp, context, monthlyCTC));
      context[comp.code] = amount;
      earnings.push({ code: comp.code, name: comp.name, amount, calculationType: comp.calculationType });
    }

    const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    context['GROSS'] = grossEarnings;

    // Estimate statutory deductions
    const basic = context['BASIC'] || 0;
    const pfWage = Math.min(basic, 15000);
    context['PF_EMPLOYEE'] = Math.round(pfWage * 0.12);
    context['PF_EMPLOYER'] = Math.round(pfWage * 0.1367); // EPF 3.67% + EPS 8.33% + EDLI 0.5% + admin
    context['ESI_EMPLOYEE'] = grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
    context['PT'] = 0;   // state-specific, unknown without employee state
    context['LWF'] = 0;  // state-specific
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

    return {
      ctc: dto.ctc,
      monthly: monthlyCTC,
      earnings,
      deductions,
      grossEarnings,
      totalDeductions,
      netPay: Math.max(grossEarnings - totalDeductions, 0),
      notes: ['PT and LWF depend on employee state', 'TDS requires full-year projection', 'ESI waived for gross > ₹21,000/month'],
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
