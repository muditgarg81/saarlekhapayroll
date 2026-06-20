import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Saarlekha Payroll...');

  // Create demo company
  const company = await prisma.company.upsert({
    where: { id: 'demo-company-001' },
    create: {
      id: 'demo-company-001',
      name: 'Demo Technologies Pvt Ltd',
      legalName: 'Demo Technologies Private Limited',
      pan: 'AABCD1234E',
      tan: 'MUMA12345A',
      pfRegistrationNo: 'MH/MUM/12345',
      esiRegistrationNo: '41000123456789',
      state: 'Maharashtra',
      industry: 'Technology',
    },
    update: {},
  });

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    create: {
      email: 'admin@demo.com',
      passwordHash,
      role: 'ADMIN',
      companyId: company.id,
    },
    update: {},
  });

  // Second admin — needed as the "checker" since a payrun cannot be approved
  // by the same user who created it (maker-checker rule).
  await prisma.user.upsert({
    where: { email: 'approver@demo.com' },
    create: {
      email: 'approver@demo.com',
      passwordHash,
      role: 'ADMIN',
      companyId: company.id,
    },
    update: {},
  });

  // Create head-office branch
  const hoBranch = await prisma.branch.upsert({
    where: { id: 'branch-mum' },
    create: {
      id: 'branch-mum',
      name: 'Mumbai Head Office',
      code: 'MUM',
      addressLine1: '123 MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      isHeadOffice: true,
      companyId: company.id,
    },
    update: {},
  });

  // Create departments
  const engineering = await prisma.department.upsert({
    where: { id: 'dept-eng' },
    create: { id: 'dept-eng', name: 'Engineering', code: 'ENG', type: 'DEPARTMENT', companyId: company.id },
    update: {},
  });

  const hr = await prisma.department.upsert({
    where: { id: 'dept-hr' },
    create: { id: 'dept-hr', name: 'Human Resources', code: 'HR', type: 'DEPARTMENT', companyId: company.id },
    update: {},
  });

  // A team nested under Engineering — demonstrates dept → team hierarchy
  await prisma.department.upsert({
    where: { id: 'team-platform' },
    create: { id: 'team-platform', name: 'Platform Team', code: 'ENG-PLAT', type: 'TEAM', parentId: engineering.id, companyId: company.id },
    update: { parentId: engineering.id, type: 'TEAM' },
  });

  // Seed salary components
  const components = [
    { id: 'comp-basic', code: 'BASIC', name: 'Basic Salary', type: 'EARNING', calculationType: 'PERCENTAGE_OF_CTC', value: 40, isTaxable: true, isStatutory: false },
    { id: 'comp-hra', code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', calculationType: 'PERCENTAGE_OF_BASIC', value: 50, isTaxable: false, isStatutory: false },
    { id: 'comp-da', code: 'DA', name: 'Dearness Allowance', type: 'EARNING', calculationType: 'PERCENTAGE_OF_BASIC', value: 10, isTaxable: true, isStatutory: false },
    { id: 'comp-sa', code: 'SA', name: 'Special Allowance', type: 'EARNING', calculationType: 'FIXED', value: 5000, isTaxable: true, isStatutory: false },
    { id: 'comp-pf', code: 'PF_EMPLOYEE', name: 'PF Employee', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_BASIC', value: 12, isTaxable: false, isStatutory: true },
    { id: 'comp-esi', code: 'ESI_EMPLOYEE', name: 'ESI Employee', type: 'DEDUCTION', calculationType: 'PERCENTAGE_OF_GROSS', value: 0.75, isTaxable: false, isStatutory: true },
    { id: 'comp-pt', code: 'PT', name: 'Professional Tax', type: 'DEDUCTION', calculationType: 'FIXED', value: 200, isTaxable: false, isStatutory: true },
    { id: 'comp-tds', code: 'TDS', name: 'Income Tax (TDS)', type: 'DEDUCTION', calculationType: 'FORMULA', value: 0, formula: '0', isTaxable: false, isStatutory: true },
  ];

  for (const comp of components) {
    await prisma.salaryComponent.upsert({
      where: { id: comp.id },
      create: { ...comp, companyId: company.id, isActive: true },
      update: {},
    });
  }

  // Create salary structure
  const structure = await prisma.salaryStructure.upsert({
    where: { id: 'struct-standard' },
    create: {
      id: 'struct-standard',
      name: 'Standard Structure',
      description: 'Default salary structure for full-time employees',
      companyId: company.id,
      components: {
        create: components.map((c, i) => ({ componentId: c.id, order: i })),
      },
    },
    update: {},
  });

  // Ensure every component is linked to the structure (idempotent on re-seed,
  // so newly added components like ESI get wired into the existing structure)
  for (let i = 0; i < components.length; i++) {
    await prisma.salaryStructureComponent.upsert({
      where: { salaryStructureId_componentId: { salaryStructureId: structure.id, componentId: components[i].id } },
      create: { salaryStructureId: structure.id, componentId: components[i].id, order: i },
      update: { order: i },
    });
  }

  // Create sample employees
  const emp1 = await prisma.employee.upsert({
    where: { id: 'emp-001' },
    create: {
      id: 'emp-001',
      employeeCode: 'EMP0001',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@demo.com',
      phone: '9876543210',
      dateOfBirth: new Date('1992-05-15'),
      gender: 'FEMALE',
      pan: 'ABCPS1234D',
      uan: '100123456789',
      designation: 'Senior Software Engineer',
      departmentId: engineering.id,
      branchId: hoBranch.id,
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      dateOfJoining: new Date('2022-03-01'),
      salaryStructureId: structure.id,
      ctc: 1200000,
      companyId: company.id,
      addressLine1: '123 MG Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      bankName: 'HDFC Bank',
      accountNumber: '50100123456789',
      ifscCode: 'HDFC0001234',
      accountType: 'SAVINGS',
    },
    update: { branchId: hoBranch.id },
  });

  const emp2 = await prisma.employee.upsert({
    where: { id: 'emp-002' },
    create: {
      id: 'emp-002',
      employeeCode: 'EMP0002',
      firstName: 'Rahul',
      lastName: 'Verma',
      email: 'rahul.verma@demo.com',
      phone: '9876543211',
      dateOfBirth: new Date('1990-08-20'),
      gender: 'MALE',
      pan: 'ABCPV1234E',
      uan: '100123456790',
      designation: 'HR Manager',
      departmentId: hr.id,
      branchId: hoBranch.id,
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      dateOfJoining: new Date('2021-06-15'),
      salaryStructureId: structure.id,
      ctc: 900000,
      companyId: company.id,
      addressLine1: '456 Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      bankName: 'ICICI Bank',
      accountNumber: '123456789012',
      ifscCode: 'ICIC0000123',
      accountType: 'SAVINGS',
    },
    update: { branchId: hoBranch.id },
  });

  // Create leave policies
  const leavePolicies = [
    { leaveType: 'CASUAL', name: 'Casual Leave', annualAllotment: 12, isPaid: true },
    { leaveType: 'SICK', name: 'Sick Leave', annualAllotment: 12, isPaid: true },
    { leaveType: 'EARNED', name: 'Earned Leave', annualAllotment: 21, isPaid: true, carryForwardAllowed: true, maxCarryForward: 30 },
    { leaveType: 'MATERNITY', name: 'Maternity Leave', annualAllotment: 182, isPaid: true },
    { leaveType: 'PATERNITY', name: 'Paternity Leave', annualAllotment: 15, isPaid: true },
  ];

  for (const lp of leavePolicies) {
    await prisma.leavePolicy.upsert({
      where: { id: `lp-${lp.leaveType.toLowerCase()}` },
      create: { id: `lp-${lp.leaveType.toLowerCase()}`, ...lp, companyId: company.id, isActive: true },
      update: {},
    });
  }

  // Seed holidays
  const holidays = [
    { name: 'Republic Day', date: new Date('2025-01-26') },
    { name: 'Holi', date: new Date('2025-03-14') },
    { name: 'Good Friday', date: new Date('2025-04-18') },
    { name: 'Independence Day', date: new Date('2025-08-15') },
    { name: 'Gandhi Jayanti', date: new Date('2025-10-02') },
    { name: 'Diwali', date: new Date('2025-10-20') },
    { name: 'Christmas', date: new Date('2025-12-25') },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { companyId_date_name: { companyId: company.id, date: h.date, name: h.name } },
      create: { ...h, companyId: company.id, type: 'NATIONAL' },
      update: {},
    });
  }

  console.log('Seed complete!');
  console.log('Login (maker):   admin@demo.com / password123');
  console.log('Login (checker): approver@demo.com / password123');
  console.log(`Company: ${company.name}`);
  console.log(`Employees: Priya Sharma (EMP0001), Rahul Verma (EMP0002)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
