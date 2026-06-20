import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true, email: true, role: true, isActive: true,
        mfaEnabled: true, lastLoginAt: true, createdAt: true,
        employee: { select: { id: true, firstName: true, lastName: true, designation: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(companyId: string, actorId: string, dto: {
    email: string;
    password: string;
    role: string;
    employeeId?: string;
  }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    if (!ALLOWED_ROLES.includes(dto.role)) {
      throw new ForbiddenException(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }

    if (dto.employeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
      if (!emp || emp.companyId !== companyId) {
        throw new NotFoundException('Employee not found in your company');
      }
      const alreadyLinked = await this.prisma.user.findFirst({ where: { employeeId: dto.employeeId } });
      if (alreadyLinked) throw new ConflictException('This employee already has a user account');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: dto.role, companyId, employeeId: dto.employeeId ?? null },
      select: { id: true, email: true, role: true, isActive: true, employeeId: true, createdAt: true },
    });

    await this.audit.log(actorId, companyId, 'CREATE', 'User', user.id,
      `User ${dto.email} created with role ${dto.role}`);
    return user;
  }

  async update(id: string, companyId: string, actorId: string, dto: {
    role?: string;
    isActive?: boolean;
    employeeId?: string | null;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.companyId !== companyId) throw new NotFoundException('User not found');

    // Prevent demoting the last admin
    if (dto.role && dto.role !== 'ADMIN' && user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { companyId, role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) throw new ForbiddenException('Cannot change role of the last admin');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role, isActive: dto.isActive, employeeId: dto.employeeId },
      select: { id: true, email: true, role: true, isActive: true, employeeId: true },
    });

    await this.audit.log(actorId, companyId, 'UPDATE', 'User', id,
      `User ${user.email} updated`, { role: user.role, isActive: user.isActive }, dto);
    return updated;
  }

  async resetPassword(id: string, companyId: string, actorId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.companyId !== companyId) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'User', id,
      `Password reset for ${user.email} by admin`);
    return { message: 'Password reset successfully' };
  }
}
