import { IsEmail, IsString, MinLength, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  companyName: string;

  @IsString()
  @Length(10, 10)
  companyPan: string;

  @IsString()
  companyState: string;
}
