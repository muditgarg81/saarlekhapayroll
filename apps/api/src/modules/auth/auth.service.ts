import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  // ── Login (step 1) ────────────────────────────────────────
  async login(dto: LoginDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: true, company: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit.log(user.id, user.companyId, 'LOGIN', 'User', user.id,
        'Failed login attempt', undefined, undefined, ip, ua);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // If MFA is enabled → issue a short-lived temp token for step 2
    if (user.mfaEnabled) {
      const tempToken = this.jwt.sign(
        { sub: user.id, mfaChallenge: true },
        { expiresIn: '5m' },
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaTempToken: tempToken, mfaTempExpiry: new Date(Date.now() + 5 * 60 * 1000) },
      });
      return { mfaRequired: true, tempToken };
    }

    await this.audit.log(user.id, user.companyId, 'LOGIN', 'User', user.id, 'Successful login', undefined, undefined, ip, ua);
    return this.issueTokens(user);
  }

  // ── Login (step 2 — MFA verify) ───────────────────────────
  async verifyMfa(tempToken: string, totp: string, ip?: string, ua?: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedException('MFA token expired or invalid');
    }
    if (!payload.mfaChallenge) throw new UnauthorizedException('Invalid challenge token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: true, company: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');
    if (user.mfaTempToken !== tempToken) throw new UnauthorizedException('Token already used');
    if (!user.mfaSecret) throw new UnauthorizedException('MFA not configured');

    const valid = speakeasy.totp.verify({ token: totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
    if (!valid) {
      // Try backup codes
      const backupCodes: string[] = JSON.parse(user.mfaBackupCodes || '[]');
      const matchIdx = await this.findBackupCode(totp, backupCodes);
      if (matchIdx === -1) {
        await this.audit.log(user.id, user.companyId, 'LOGIN', 'User', user.id, 'Failed MFA attempt', undefined, undefined, ip, ua);
        throw new UnauthorizedException('Invalid TOTP code');
      }
      // Consume backup code
      backupCodes.splice(matchIdx, 1);
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodes: JSON.stringify(backupCodes) } });
    }

    // Clear temp token
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaTempToken: null, mfaTempExpiry: null } });
    await this.audit.log(user.id, user.companyId, 'LOGIN', 'User', user.id, 'Successful MFA login', undefined, undefined, ip, ua);
    return this.issueTokens(user);
  }

  // ── MFA Setup ─────────────────────────────────────────────
  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');

    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const otpAuthUrl = speakeasy.otpauthURL({ secret, label: user.email, issuer: `Saarlekha / ${user.company.name}`, encoding: 'base32' });
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store secret tentatively (not enabled yet until verified)
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    return { secret, qrDataUrl, otpAuthUrl };
  }

  async enableMfa(userId: string, companyId: string, totp: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('Run /auth/mfa/setup first');
    if (user.mfaEnabled) throw new BadRequestException('MFA already enabled');

    const valid = speakeasy.totp.verify({ token: totp, secret: user.mfaSecret, encoding: 'base32', window: 1 });
    if (!valid) throw new BadRequestException('Invalid TOTP code — ensure your authenticator clock is synced');

    const backupCodes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10).toUpperCase());
    const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodes: JSON.stringify(hashedCodes) },
    });

    await this.audit.log(userId, companyId, 'UPDATE', 'User', userId, 'MFA enabled');
    return { backupCodes }; // shown once — user must save these
  }

  async disableMfa(userId: string, companyId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
    });
    await this.audit.log(userId, companyId, 'UPDATE', 'User', userId, 'MFA disabled');
    return { message: 'MFA disabled successfully' };
  }

  // ── Register ──────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const company = await this.prisma.company.create({
      data: { name: dto.companyName, legalName: dto.companyName, pan: dto.companyPan, state: dto.companyState },
    });

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: 'ADMIN', companyId: company.id },
      include: { company: true },
    });

    await this.audit.log(user.id, company.id, 'CREATE', 'Company', company.id, `Company "${dto.companyName}" registered`);
    return this.issueTokens(user as any);
  }

  // ── Profile ───────────────────────────────────────────────
  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, role: true, companyId: true,
        mfaEnabled: true, lastLoginAt: true,
        employee: { select: { id: true, firstName: true, lastName: true, designation: true } },
      },
    });
  }

  // ── Change password ───────────────────────────────────────
  async changePassword(userId: string, companyId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.audit.log(userId, companyId, 'UPDATE', 'User', userId, 'Password changed');
    return { message: 'Password changed successfully' };
  }

  // ── Helpers ───────────────────────────────────────────────
  private issueTokens(user: any) {
    const payload = {
      sub: user.id, email: user.email, role: user.role,
      companyId: user.companyId, employeeId: user.employeeId ?? null,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id, email: user.email, role: user.role,
        companyId: user.companyId, employeeId: user.employeeId,
        mfaEnabled: user.mfaEnabled,
        companyName: user.company?.name,
        employee: user.employee
          ? { id: user.employee.id, firstName: user.employee.firstName, lastName: user.employee.lastName }
          : null,
      },
    };
  }

  private async findBackupCode(plain: string, hashed: string[]): Promise<number> {
    for (let i = 0; i < hashed.length; i++) {
      if (await bcrypt.compare(plain, hashed[i])) return i;
    }
    return -1;
  }
}
