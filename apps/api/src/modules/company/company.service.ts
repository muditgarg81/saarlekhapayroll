import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const PAYROLL_CYCLES = ['MONTHLY', 'WEEKLY'];

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const c = await this.prisma.company.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Company not found');
    return c;
  }

  async update(id: string, dto: any) {
    if (dto.financialYearStart !== undefined) {
      const m = Number(dto.financialYearStart);
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        throw new BadRequestException('financialYearStart must be a month number between 1 and 12');
      }
      dto.financialYearStart = m;
    }
    if (dto.payrollCycle !== undefined && !PAYROLL_CYCLES.includes(dto.payrollCycle)) {
      throw new BadRequestException(`payrollCycle must be one of: ${PAYROLL_CYCLES.join(', ')}`);
    }
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async getDashboard(companyId: string) {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const [totalEmployees, activeEmployees, latestPayrun, pendingLeaves] = await Promise.all([
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.payrun.findFirst({
        where: { companyId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.leaveApplication.count({
        where: { status: 'PENDING', employee: { companyId } },
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      latestPayrun: latestPayrun
        ? { month: latestPayrun.month, year: latestPayrun.year, status: latestPayrun.status, netPay: latestPayrun.totalNetPay }
        : null,
      currentMonth: month,
      currentYear: year,
    };
  }
}
