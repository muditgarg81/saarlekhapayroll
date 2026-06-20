export enum PayrollCycle {
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
}

export enum DepartmentType {
  DEPARTMENT = 'DEPARTMENT',
  TEAM = 'TEAM',
}

export interface Company {
  id: string;
  name: string;
  legalName: string;
  cin?: string;
  pan: string;
  tan?: string;
  pfRegistrationNo?: string;
  esiRegistrationNo?: string;
  gstNo?: string;
  industry?: string;
  state: string;
  payrollCycle: PayrollCycle;
  financialYearStart: number; // 1-12, India default 4 (April)
  logoUrl?: string;
  isActive: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  addressLine1?: string;
  city?: string;
  state: string;
  pincode?: string;
  isHeadOffice: boolean;
  isActive: boolean;
  companyId: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  type: DepartmentType;
  parentId?: string;
  headId?: string;
  companyId: string;
  children?: Department[];
}

export interface CreateBranchDto {
  name: string;
  code: string;
  state: string;
  addressLine1?: string;
  city?: string;
  pincode?: string;
  isHeadOffice?: boolean;
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  type?: DepartmentType;
  parentId?: string;
  headId?: string;
}
