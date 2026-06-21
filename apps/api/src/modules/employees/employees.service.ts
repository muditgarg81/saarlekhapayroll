import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const DOCUMENT_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'BANK_PROOF', 'OFFER_LETTER', 'EDUCATION', 'OTHER'];

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: any) {
    const code = await this.generateEmployeeCode(companyId);

    const existing = await this.prisma.employee.findFirst({
      where: { email: dto.email, companyId },
    });
    if (existing) throw new ConflictException('Employee with this email already exists');

    const panDupe = await this.prisma.employee.findFirst({ where: { pan: dto.pan, companyId } });
    if (panDupe) throw new ConflictException('An employee with this PAN already exists');

    // Referential integrity — referenced entities must belong to this company
    await this.assertBelongs('department', dto.departmentId, companyId);
    await this.assertBelongs('salaryStructure', dto.salaryStructureId, companyId);
    if (dto.branchId) await this.assertBelongs('branch', dto.branchId, companyId);
    if (dto.managerId) await this.assertBelongs('employee', dto.managerId, companyId);

    return this.prisma.employee.create({
      data: {
        ...dto,
        employeeCode: code,
        companyId,
        dateOfBirth: new Date(dto.dateOfBirth),
        dateOfJoining: new Date(dto.dateOfJoining),
      },
      include: { department: true, branch: true, salaryStructure: true },
    });
  }

  private async assertBelongs(model: 'department' | 'salaryStructure' | 'branch' | 'employee', id: string, companyId: string) {
    const row = await (this.prisma as any)[model].findUnique({ where: { id }, select: { companyId: true } });
    if (!row || row.companyId !== companyId) {
      throw new BadRequestException(`Invalid ${model}Id — must belong to your company`);
    }
  }

  // ─── Documents ───────────────────────────────────────────
  async listDocuments(employeeId: string, companyId: string) {
    await this.findOne(employeeId, companyId);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(employeeId: string, companyId: string, uploadedBy: string, dto: any) {
    await this.findOne(employeeId, companyId);
    if (!DOCUMENT_TYPES.includes(dto.type)) {
      throw new BadRequestException(`type must be one of: ${DOCUMENT_TYPES.join(', ')}`);
    }
    if (!dto.fileName || !dto.fileUrl) {
      throw new BadRequestException('fileName and fileUrl are required');
    }
    return this.prisma.employeeDocument.create({
      data: {
        employeeId,
        type: dto.type,
        fileName: dto.fileName,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        number: dto.number,
        uploadedBy,
      },
    });
  }

  async removeDocument(employeeId: string, docId: string, companyId: string) {
    await this.findOne(employeeId, companyId);
    const doc = await this.prisma.employeeDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.employeeId !== employeeId) throw new NotFoundException('Document not found');
    return this.prisma.employeeDocument.delete({ where: { id: docId } });
  }

  async findAll(companyId: string, filters?: { status?: string; departmentId?: string; search?: string }) {
    const where: any = { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.employee.findMany({
      where,
      include: { department: true },
      orderBy: { firstName: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        branch: true,
        documents: { orderBy: { createdAt: 'desc' } },
        salaryStructure: { include: { components: { include: { component: true } } } },
      },
    });
    if (!emp || emp.companyId !== companyId) throw new NotFoundException('Employee not found');
    return emp;
  }

  async update(id: string, companyId: string, dto: any) {
    await this.findOne(id, companyId);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: { department: true },
    });
  }

  async terminate(id: string, companyId: string, dateOfLeaving: string) {
    await this.findOne(id, companyId);
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED', dateOfLeaving: new Date(dateOfLeaving) },
    });
  }

  async getSalaryBreakdown(id: string, companyId: string) {
    const emp = await this.findOne(id, companyId);
    const monthlyCTC = emp.ctc / 12;
    const context: Record<string, number> = { CTC: emp.ctc, MONTHLY_CTC: monthlyCTC };

    const earnings: any[] = [];
    const deductions: any[] = [];

    for (const sc of emp.salaryStructure.components) {
      const comp = sc.component;
      let amount = 0;
      if (comp.calculationType === 'PERCENTAGE_OF_CTC') amount = (monthlyCTC * comp.value) / 100;
      else if (comp.calculationType === 'PERCENTAGE_OF_BASIC') amount = ((context['BASIC'] || 0) * comp.value) / 100;
      else if (comp.calculationType === 'FIXED') amount = comp.value;
      amount = Math.round(amount);
      context[comp.code] = amount;

      if (comp.type === 'EARNING') earnings.push({ name: comp.name, code: comp.code, amount });
      else deductions.push({ name: comp.name, code: comp.code, amount });
    }

    return {
      ctc: emp.ctc,
      monthly: monthlyCTC,
      earnings,
      deductions,
      grossEarnings: earnings.reduce((s: number, e: any) => s + e.amount, 0),
      totalDeductions: deductions.reduce((s: number, d: any) => s + d.amount, 0),
    };
  }

  async bulkImport(companyId: string, records: any[]) {
    const results = [];
    const errors = [];
    let count = await this.prisma.employee.count({ where: { companyId } });

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        // Resolve department name to departmentId if provided
        if (record.department && !record.departmentId) {
          const deptName = record.department.trim();
          const dept = await this.prisma.department.findFirst({
            where: {
              name: { equals: deptName, mode: 'insensitive' },
              companyId,
            },
          });
          if (dept) {
            record.departmentId = dept.id;
          } else {
            throw new BadRequestException(`Department "${deptName}" not found`);
          }
        }

        if (!record.firstName || !record.lastName || !record.email || !record.pan || !record.designation || !record.salaryStructureId || !record.departmentId || !record.dateOfBirth || !record.dateOfJoining || record.ctc === undefined || !record.addressLine1 || !record.city || !record.state || !record.pincode || !record.bankName || !record.accountNumber || !record.ifscCode) {
          throw new BadRequestException('Missing required fields');
        }

        // Email uniqueness
        const existingEmail = await this.prisma.employee.findFirst({
          where: { email: record.email, companyId },
        });
        if (existingEmail) {
          throw new ConflictException(`Employee with email ${record.email} already exists`);
        }

        // PAN uniqueness
        const existingPan = await this.prisma.employee.findFirst({
          where: { pan: record.pan, companyId },
        });
        if (existingPan) {
          throw new ConflictException(`Employee with PAN ${record.pan} already exists`);
        }

        // Validate referential belongs
        await this.assertBelongs('department', record.departmentId, companyId);
        await this.assertBelongs('salaryStructure', record.salaryStructureId, companyId);
        if (record.branchId) {
          await this.assertBelongs('branch', record.branchId, companyId);
        }
        if (record.managerId) {
          await this.assertBelongs('employee', record.managerId, companyId);
        }

        count++;
        const employeeCode = `EMP${String(count).padStart(4, '0')}`;

        const created = await this.prisma.employee.create({
          data: {
            ...record,
            employeeCode,
            companyId,
            dateOfBirth: new Date(record.dateOfBirth),
            dateOfJoining: new Date(record.dateOfJoining),
            ctc: Number(record.ctc),
          },
        });
        results.push(created);
      } catch (err: any) {
        errors.push({
          row: i + 1,
          email: record.email || 'Unknown',
          name: record.firstName ? `${record.firstName} ${record.lastName || ''}`.trim() : 'Unknown',
          error: err.response?.message || err.message || 'Validation failed',
        });
        count--;
      }
    }

    return {
      successCount: results.length,
      failedCount: errors.length,
      errors,
    };
  }

  private async generateEmployeeCode(companyId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { companyId } });
    return `EMP${String(count + 1).padStart(4, '0')}`;
  }
}
