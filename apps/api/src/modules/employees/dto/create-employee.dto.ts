import {
  IsString, IsEmail, IsOptional, Matches, Length, IsNumber, Min,
  IsIn, IsDateString, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_REGEX = /^[6-9][0-9]{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export class BankDetailsDto {
  @IsString() bankName: string;
  @IsString() @Length(9, 18) accountNumber: string;
  @Matches(IFSC_REGEX, { message: 'ifscCode must be a valid IFSC (e.g. HDFC0001234)' })
  ifscCode: string;
  @IsIn(['SAVINGS', 'CURRENT']) accountType: string;
}

export class CreateEmployeeDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @Matches(PHONE_REGEX, { message: 'phone must be a valid 10-digit Indian mobile number' })
  phone: string;
  @IsDateString() dateOfBirth: string;
  @IsIn(['MALE', 'FEMALE', 'OTHER']) gender: string;

  @Matches(PAN_REGEX, { message: 'pan must be a valid PAN (e.g. ABCDE1234F)' })
  pan: string;
  @IsOptional() @Matches(AADHAAR_REGEX, { message: 'aadhaar must be 12 digits' })
  aadhaar?: string;
  @IsOptional() @IsString() uan?: string;
  @IsOptional() @IsString() esiNumber?: string;

  @IsString() designation: string;
  @IsOptional() @IsString() grade?: string;
  @IsString() departmentId: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN']) employmentType: string;
  @IsDateString() dateOfJoining: string;

  @IsString() salaryStructureId: string;
  @IsNumber() @Min(0) ctc: number;

  // Address (flat — matches the Prisma model)
  @IsString() addressLine1: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsString() city: string;
  @IsString() state: string;
  @Matches(PINCODE_REGEX, { message: 'pincode must be a valid 6-digit Indian PIN' })
  pincode: string;

  // Bank (flat)
  @IsString() bankName: string;
  @IsString() @Length(9, 18) accountNumber: string;
  @Matches(IFSC_REGEX, { message: 'ifscCode must be a valid IFSC (e.g. HDFC0001234)' })
  ifscCode: string;
  @IsIn(['SAVINGS', 'CURRENT']) accountType: string;
}
