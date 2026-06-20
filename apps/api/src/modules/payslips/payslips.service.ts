import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PayslipsService {
  constructor(private prisma: PrismaService) {}

  async findByEmployee(employeeId: string, year?: number) {
    return this.prisma.payslip.findMany({
      where: { employeeId, ...(year ? { year } : {}) },
      include: { lines: { include: { component: true } }, payrun: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: { include: { company: true } },
        lines: { include: { component: true } },
        payrun: true,
      },
    });
    if (!p) throw new NotFoundException('Payslip not found');
    return p;
  }
}
