import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ComplianceService } from '../compliance/compliance.service';

export interface CalculatedPayslip {
  employeeId: string;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  earnings: { componentId: string; componentName: string; componentCode: string; amount: number }[];
  deductions: { componentId: string; componentName: string; componentCode: string; amount: number }[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

@Injectable()
export class PayrollEngine {
  constructor(
    private prisma: PrismaService,
    private compliance: ComplianceService,
  ) {}

  async calculatePayslip(
    employeeId: string,
    month: number,
    year: number,
    workingDays: number,
    lopDays: number,
  ): Promise<CalculatedPayslip> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        salaryStructure: {
          include: {
            components: {
              include: { component: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    const paidDays = workingDays - lopDays;
    const attendanceFactor = paidDays / workingDays;
    const monthlyCTC = employee.ctc / 12;

    // Resolve salary components in order
    const context: Record<string, number> = {
      CTC: employee.ctc,
      MONTHLY_CTC: monthlyCTC,
      ATTENDANCE_FACTOR: attendanceFactor,
    };

    const earnings: CalculatedPayslip['earnings'] = [];
    const deductions: CalculatedPayslip['deductions'] = [];

    // Fetch PF config early to support dynamic PF_EMPLOYER calculation during the earnings loop
    const pfConfig = await this.compliance.getPFConfig(employee.companyId);

    for (const sc of employee.salaryStructure.components) {
      const comp = sc.component;

      // Calculate PF_EMPLOYER dynamically if BASIC is resolved and PF_EMPLOYER is not set yet
      if (context['BASIC'] && !context['PF_EMPLOYER']) {
        const basic = context['BASIC'];
        const pfWage = Math.min(basic, pfConfig.wageLimit);
        context['PF_EMPLOYER'] = Math.round((pfWage * (pfConfig.employerEPFRate + pfConfig.employerEPSRate)) / 100);
        context['PF_EMPLOYEE'] = Math.round((pfWage * pfConfig.employeeContributionRate) / 100);
      }

      let amount = this.resolveComponent(comp, context, monthlyCTC);
      // Apply LOP for non-statutory earnings
      if (comp.type === 'EARNING' && !comp.isStatutory) {
        amount = amount * attendanceFactor;
      }
      amount = Math.round(amount);
      context[comp.code] = amount;

      if (comp.type === 'EARNING') {
        earnings.push({ componentId: comp.id, componentName: comp.name, componentCode: comp.code, amount });
      }
    }

    const grossEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    context['GROSS'] = grossEarnings;

    // PF calculation
    if (context['PF_EMPLOYEE'] === undefined) {
      const pfWage = Math.min(context['BASIC'] || 0, pfConfig.wageLimit);
      const pfEmployee = Math.round((pfWage * pfConfig.employeeContributionRate) / 100);
      const pfEmployer = Math.round((pfWage * (pfConfig.employerEPFRate + pfConfig.employerEPSRate)) / 100);
      context['PF_EMPLOYEE'] = pfEmployee;
      context['PF_EMPLOYER'] = pfEmployer;
    }

    // ESI calculation
    const esiConfig = await this.compliance.getESIConfig(employee.companyId);
    let esiEmployee = 0;
    if (grossEarnings <= esiConfig.wageLimit) {
      esiEmployee = Math.round((grossEarnings * esiConfig.employeeContributionRate) / 100);
    }
    context['ESI_EMPLOYEE'] = esiEmployee;

    // Professional Tax
    const pt = await this.compliance.calculatePT(employee.state, grossEarnings);
    context['PT'] = pt;

    // TDS
    const tds = await this.compliance.calculateMonthlyTDS(employeeId, employee.ctc, month, year);
    context['TDS'] = tds;

    // Build deductions list from structure
    for (const sc of employee.salaryStructure.components) {
      const comp = sc.component;
      if (comp.type === 'DEDUCTION') {
        const amount = context[comp.code] ?? 0;
        deductions.push({ componentId: comp.id, componentName: comp.name, componentCode: comp.code, amount });
      }
    }

    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
    const netPay = grossEarnings - totalDeductions;

    return {
      employeeId,
      workingDays,
      paidDays,
      lopDays,
      earnings,
      deductions,
      grossEarnings,
      totalDeductions,
      netPay: Math.max(netPay, 0),
    };
  }

  private resolveComponent(
    comp: { calculationType: string; value: number; formula?: string | null; code: string },
    context: Record<string, number>,
    monthlyCTC: number,
  ): number {
    switch (comp.calculationType) {
      case 'FIXED':
        return comp.value;
      case 'PERCENTAGE_OF_CTC':
        return (monthlyCTC * comp.value) / 100;
      case 'PERCENTAGE_OF_BASIC':
        return ((context['BASIC'] || 0) * comp.value) / 100;
      case 'PERCENTAGE_OF_GROSS':
        return ((context['GROSS'] || 0) * comp.value) / 100;
      case 'FORMULA':
        return this.evaluateFormula(comp.formula || '0', context);
      default:
        return 0;
    }
  }

  private evaluateFormula(formula: string, context: Record<string, number>): number {
    try {
      // Replace variable names with their values
      let expr = formula;
      for (const [key, val] of Object.entries(context)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val));
      }
      // Safe numeric eval — only numbers and operators
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        return Function(`"use strict"; return (${expr})`)() as number;
      }
      return 0;
    } catch {
      return 0;
    }
  }
}
