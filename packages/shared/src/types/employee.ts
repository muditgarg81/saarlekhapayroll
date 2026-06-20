export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACTOR = 'CONTRACTOR',
  INTERN = 'INTERN',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum DocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  PASSPORT = 'PASSPORT',
  BANK_PROOF = 'BANK_PROOF',
  OFFER_LETTER = 'OFFER_LETTER',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER',
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  number?: string;
  createdAt: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'SAVINGS' | 'CURRENT';
  branchName?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  pan: string;
  aadhaar?: string;
  uan?: string; // Universal Account Number for PF
  esiNumber?: string;
  designation: string;
  departmentId: string;
  managerId?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining: string;
  dateOfLeaving?: string;
  probationEndDate?: string;
  salaryStructureId: string;
  ctc: number;
  address: Address;
  bankDetails: BankDetails;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  pan: string;
  aadhaar?: string;
  designation: string;
  departmentId: string;
  managerId?: string;
  employmentType: EmploymentType;
  dateOfJoining: string;
  salaryStructureId: string;
  ctc: number;
  address: Address;
  bankDetails: BankDetails;
}
