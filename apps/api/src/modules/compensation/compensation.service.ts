import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CompensationService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ═══ Salary Revisions ═══════════════════════════════════════
  async createRevision(companyId: string, actorId: string, dto: {
    employeeId: string; effectiveDate: string; newCtc: number; newStructureId?: string; reason?: string;
  }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (dto.newCtc <= 0) throw new BadRequestException('New CTC must be positive');

    const changeAmount = dto.newCtc - emp.ctc;
    const changePct = emp.ctc > 0 ? (changeAmount / emp.ctc) * 100 : 0;

    const revision = await this.prisma.salaryRevision.create({
      data: {
        companyId, employeeId: dto.employeeId, effectiveDate: new Date(dto.effectiveDate),
        previousCtc: emp.ctc, newCtc: dto.newCtc, changeAmount, changePct: Math.round(changePct * 100) / 100,
        previousStructureId: emp.salaryStructureId, newStructureId: dto.newStructureId || emp.salaryStructureId,
        reason: dto.reason, revisedBy: actorId,
      },
    });

    // Apply the revision to the employee record
    await this.prisma.employee.update({
      where: { id: dto.employeeId },
      data: { ctc: dto.newCtc, ...(dto.newStructureId ? { salaryStructureId: dto.newStructureId } : {}) },
    });

    await this.audit.log(actorId, companyId, 'UPDATE', 'SalaryRevision', revision.id,
      `Salary revised for ${emp.firstName} ${emp.lastName}: ₹${emp.ctc} → ₹${dto.newCtc} (${changePct >= 0 ? '+' : ''}${Math.round(changePct)}%)`);
    return revision;
  }

  async listRevisions(companyId: string, employeeId?: string) {
    return this.prisma.salaryRevision.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true, designation: true } } },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  // ═══ Perquisites ════════════════════════════════════════════
  async createPerquisite(companyId: string, actorId: string, dto: {
    employeeId: string; financialYear: string; type: string; description?: string; taxableValue: number; isTaxable?: boolean;
  }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    const perq = await this.prisma.perquisite.create({
      data: { companyId, employeeId: dto.employeeId, financialYear: dto.financialYear, type: dto.type,
        description: dto.description, taxableValue: dto.taxableValue, isTaxable: dto.isTaxable ?? true, createdBy: actorId },
    });
    await this.audit.log(actorId, companyId, 'CREATE', 'Perquisite', perq.id, `Perquisite ${dto.type} ₹${dto.taxableValue} for ${emp.firstName} ${emp.lastName}`);
    return perq;
  }

  async deletePerquisite(id: string, companyId: string, actorId: string) {
    const p = await this.prisma.perquisite.findFirst({ where: { id, companyId } });
    if (!p) throw new NotFoundException('Perquisite not found');
    await this.prisma.perquisite.delete({ where: { id } });
    await this.audit.log(actorId, companyId, 'DELETE', 'Perquisite', id, 'Perquisite removed');
    return { success: true };
  }

  async perquisiteSummary(companyId: string, financialYear: string) {
    const perqs = await this.prisma.perquisite.findMany({
      where: { companyId, financialYear },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { taxableValue: 'desc' },
    });
    const byType: Record<string, number> = {};
    for (const p of perqs) byType[p.type] = (byType[p.type] || 0) + p.taxableValue;
    const rows = perqs.map(p => ({
      id: p.id, employeeCode: p.employee.employeeCode, name: `${p.employee.firstName} ${p.employee.lastName}`,
      type: p.type, description: p.description, taxableValue: Math.round(p.taxableValue), isTaxable: p.isTaxable,
    }));
    return { financialYear, rows, byType, totalTaxable: rows.filter(r => r.isTaxable).reduce((s, r) => s + r.taxableValue, 0) };
  }

  // ═══ Proof of Investment (POI) ══════════════════════════════
  async submitProof(companyId: string, actorId: string, dto: {
    employeeId: string; financialYear: string; section: string; description: string; declaredAmount?: number; proofAmount: number; fileUrl?: string;
  }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    const proof = await this.prisma.investmentProof.create({
      data: { companyId, employeeId: dto.employeeId, financialYear: dto.financialYear, section: dto.section,
        description: dto.description, declaredAmount: dto.declaredAmount || 0, proofAmount: dto.proofAmount, fileUrl: dto.fileUrl },
    });
    await this.audit.log(actorId, companyId, 'CREATE', 'InvestmentProof', proof.id, `POI submitted: ${dto.section} ₹${dto.proofAmount} for ${emp.firstName} ${emp.lastName}`);
    return proof;
  }

  async listProofs(companyId: string, filters: { financialYear?: string; status?: string; employeeId?: string }) {
    return this.prisma.investmentProof.findMany({
      where: { companyId, ...(filters.financialYear ? { financialYear: filters.financialYear } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.employeeId ? { employeeId: filters.employeeId } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewProof(id: string, companyId: string, actorId: string, status: 'VERIFIED' | 'REJECTED', proofAmount?: number, comment?: string) {
    const proof = await this.prisma.investmentProof.findFirst({ where: { id, companyId } });
    if (!proof) throw new NotFoundException('Proof not found');
    if (proof.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    const updated = await this.prisma.investmentProof.update({
      where: { id },
      data: { status, reviewedBy: actorId, reviewedAt: new Date(), reviewComment: comment, ...(proofAmount != null ? { proofAmount } : {}) },
    });
    await this.audit.log(actorId, companyId, status === 'VERIFIED' ? 'APPROVE' : 'UPDATE', 'InvestmentProof', id, `POI ${status.toLowerCase()}: ${proof.section}`);
    return updated;
  }

  // ═══ Salary Withhold ════════════════════════════════════════
  async holdSalary(companyId: string, actorId: string, dto: { employeeId: string; month: number; year: number; reason: string }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (!dto.reason?.trim()) throw new BadRequestException('A reason is required to hold salary');
    const hold = await this.prisma.salaryHold.upsert({
      where: { employeeId_month_year: { employeeId: dto.employeeId, month: dto.month, year: dto.year } },
      update: { reason: dto.reason, status: 'HELD', heldBy: actorId, releasedAt: null, releasedBy: null },
      create: { companyId, employeeId: dto.employeeId, month: dto.month, year: dto.year, reason: dto.reason, heldBy: actorId },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'SalaryHold', hold.id, `Salary HELD for ${emp.firstName} ${emp.lastName} ${dto.month}/${dto.year}: ${dto.reason}`);
    return hold;
  }

  async releaseSalary(id: string, companyId: string, actorId: string) {
    const hold = await this.prisma.salaryHold.findFirst({ where: { id, companyId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.status === 'RELEASED') throw new BadRequestException('Already released');
    const updated = await this.prisma.salaryHold.update({ where: { id }, data: { status: 'RELEASED', releasedBy: actorId, releasedAt: new Date() } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'SalaryHold', id, 'Salary released');
    return updated;
  }

  async listHolds(companyId: string, status?: string) {
    return this.prisma.salaryHold.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
