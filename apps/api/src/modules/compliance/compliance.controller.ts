import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
@Controller('compliance')
export class ComplianceController {
  constructor(private svc: ComplianceService) {}

  @Get('pf')
  pfChallan(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.svc.pfChallan(req.user.companyId, Number(month), Number(year));
  }

  @Get('esi')
  esiChallan(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.svc.esiChallan(req.user.companyId, Number(month), Number(year));
  }

  @Get('states')
  states(@Request() req: any) {
    return this.svc.getStates(req.user.companyId);
  }

  @Get('pt')
  ptRegister(@Request() req: any, @Query('month') month: string, @Query('year') year: string, @Query('state') state?: string) {
    return this.svc.ptRegister(req.user.companyId, Number(month), Number(year), state || undefined);
  }

  @Get('lwf')
  lwfRegister(@Request() req: any, @Query('month') month: string, @Query('year') year: string, @Query('state') state?: string) {
    return this.svc.lwfRegister(req.user.companyId, Number(month), Number(year), state || undefined);
  }

  @Get('gratuity')
  gratuityRegister(@Request() req: any) {
    return this.svc.gratuityRegister(req.user.companyId);
  }

  @Get('bonus')
  bonusRegister(@Request() req: any, @Query('fy') fy: string) {
    const now = new Date();
    const defaultFy = now.getMonth() >= 3
      ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
    return this.svc.bonusRegister(req.user.companyId, fy || defaultFy);
  }
}
