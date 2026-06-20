import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch || branch.companyId !== companyId) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(companyId: string, dto: any) {
    const exists = await this.prisma.branch.findFirst({ where: { code: dto.code, companyId } });
    if (exists) throw new ConflictException(`Branch code "${dto.code}" already exists`);

    // Only one head office per company
    if (dto.isHeadOffice) await this.clearHeadOffice(companyId);

    return this.prisma.branch.create({ data: { ...dto, companyId } });
  }

  async update(id: string, companyId: string, dto: any) {
    await this.findOne(id, companyId);
    if (dto.code) {
      const dupe = await this.prisma.branch.findFirst({ where: { code: dto.code, companyId, id: { not: id } } });
      if (dupe) throw new ConflictException(`Branch code "${dto.code}" already exists`);
    }
    if (dto.isHeadOffice) await this.clearHeadOffice(companyId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    const count = await this.prisma.employee.count({ where: { branchId: id } });
    if (count > 0) throw new ConflictException(`Cannot delete branch with ${count} assigned employee(s)`);
    return this.prisma.branch.delete({ where: { id } });
  }

  private async clearHeadOffice(companyId: string, exceptId?: string) {
    await this.prisma.branch.updateMany({
      where: { companyId, isHeadOffice: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isHeadOffice: false },
    });
  }
}
