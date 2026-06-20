import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    companyId: string,
    action: string,
    entity: string,
    entityId?: string,
    summary?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, companyId, action, entity, entityId, summary, oldValues, newValues, ipAddress, userAgent },
      });
    } catch {
      // Audit logging must never crash the main flow
    }
  }

  async findAll(companyId: string, filters: {
    userId?: string;
    entity?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.userId)  where.userId = filters.userId;
    if (filters.entity)  where.entity = filters.entity;
    if (filters.action)  where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
