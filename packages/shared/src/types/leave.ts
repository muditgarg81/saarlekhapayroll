export enum LeaveType {
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  EARNED = 'EARNED',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  BEREAVEMENT = 'BEREAVEMENT',
  COMPENSATORY = 'COMPENSATORY',
  UNPAID = 'UNPAID',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface LeavePolicy {
  id: string;
  companyId: string;
  leaveType: LeaveType;
  name: string;
  annualAllotment: number;
  carryForwardAllowed: boolean;
  maxCarryForward?: number;
  encashmentAllowed: boolean;
  isPaid: boolean;
  isActive: boolean;
}

export interface LeaveBalance {
  employeeId: string;
  leaveType: LeaveType;
  allocated: number;
  taken: number;
  pending: number;
  remaining: number;
  financialYear: string;
}

export interface LeaveApplication {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

export interface Holiday {
  id: string;
  companyId: string;
  name: string;
  date: string;
  type: 'NATIONAL' | 'REGIONAL' | 'RESTRICTED';
  states?: string[]; // applicable states
}
