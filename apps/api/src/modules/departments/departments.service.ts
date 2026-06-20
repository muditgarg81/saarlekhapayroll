import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId },
      include: { children: true, _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  /** Nested org tree (roots → children), built from a single query. */
  async tree(companyId: string) {
    const all = await this.prisma.department.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    const byId = new Map(all.map(d => [d.id, { ...d, children: [] as any[] }]));
    const roots: any[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string, companyId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept || dept.companyId !== companyId) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(companyId: string, dto: any) {
    const exists = await this.prisma.department.findFirst({ where: { code: dto.code, companyId } });
    if (exists) throw new ConflictException(`Department code "${dto.code}" already exists`);
    if (dto.parentId) await this.assertSameCompany(dto.parentId, companyId);
    if (dto.headId) await this.assertEmployeeInCompany(dto.headId, companyId);
    return this.prisma.department.create({ data: { ...dto, companyId } });
  }

  async update(id: string, companyId: string, dto: any) {
    await this.findOne(id, companyId);

    if (dto.code) {
      const dupe = await this.prisma.department.findFirst({ where: { code: dto.code, companyId, id: { not: id } } });
      if (dupe) throw new ConflictException(`Department code "${dto.code}" already exists`);
    }
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) throw new BadRequestException('A department cannot be its own parent');
      await this.assertSameCompany(dto.parentId, companyId);
      await this.assertNoCycle(id, dto.parentId, companyId);
    }
    if (dto.headId) await this.assertEmployeeInCompany(dto.headId, companyId);

    return this.prisma.department.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    const [childCount, empCount] = await Promise.all([
      this.prisma.department.count({ where: { parentId: id } }),
      this.prisma.employee.count({ where: { departmentId: id } }),
    ]);
    if (childCount > 0) throw new ConflictException('Cannot delete a department that has sub-departments/teams');
    if (empCount > 0) throw new ConflictException(`Cannot delete a department with ${empCount} employee(s)`);
    return this.prisma.department.delete({ where: { id } });
  }

  private async assertSameCompany(deptId: string, companyId: string) {
    const parent = await this.prisma.department.findUnique({ where: { id: deptId } });
    if (!parent || parent.companyId !== companyId) {
      throw new BadRequestException('Parent department must belong to the same company');
    }
  }

  private async assertEmployeeInCompany(employeeId: string, companyId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp || emp.companyId !== companyId) {
      throw new BadRequestException('Department head must be an employee of this company');
    }
  }

  /** Walk up from the proposed parent; if we reach `id`, the move would create a cycle. */
  private async assertNoCycle(id: string, parentId: string, companyId: string) {
    let cursor: string | null = parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id) throw new BadRequestException('Move would create a circular department hierarchy');
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const node = await this.prisma.department.findFirst({ where: { id: cursor, companyId }, select: { parentId: true } });
      cursor = node?.parentId ?? null;
    }
  }
}
