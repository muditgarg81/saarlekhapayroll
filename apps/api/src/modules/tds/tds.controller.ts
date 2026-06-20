import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TDSService } from './tds.service';

@ApiTags('TDS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tds')
export class TDSController {
  constructor(private svc: TDSService) {}

  // ── Form 12BB ─────────────────────────────────────────────
  @Get('declarations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  listDeclarations(@Request() req: any, @Query('fy') fy: string) {
    return this.svc.listDeclarations(req.user.companyId, fy || currentFY());
  }

  @Get('declarations/:employeeId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'EMPLOYEE')
  getDeclaration(@Param('employeeId') eid: string, @Request() req: any, @Query('fy') fy: string) {
    return this.svc.getDeclaration(eid, req.user.companyId, fy || currentFY());
  }

  @Post('declarations/:employeeId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'EMPLOYEE')
  saveDeclaration(@Param('employeeId') eid: string, @Request() req: any, @Body() body: any) {
    return this.svc.saveDeclaration(eid, req.user.companyId, req.user.sub, { ...body, financialYear: body.financialYear || currentFY() });
  }

  @Patch('declarations/:id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  approveDeclaration(@Param('id') id: string, @Request() req: any) {
    return this.svc.approveDeclaration(id, req.user.companyId, req.user.sub);
  }

  // ── TDS Computation ───────────────────────────────────────
  @Get('compute/:employeeId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  computeTDS(@Param('employeeId') eid: string, @Request() req: any, @Query('fy') fy: string) {
    return this.svc.computeTDS(eid, req.user.companyId, fy || currentFY());
  }

  // ── 24Q ───────────────────────────────────────────────────
  @Get('24q')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  list24Q(@Request() req: any, @Query('fy') fy: string) {
    return this.svc.list24Q(req.user.companyId, fy || currentFY());
  }

  @Get('24q/:quarter')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  compute24Q(@Param('quarter') q: string, @Request() req: any, @Query('fy') fy: string) {
    return this.svc.compute24Q(req.user.companyId, fy || currentFY(), Number(q));
  }

  @Patch('24q/:quarter/file')
  @Roles('SUPER_ADMIN', 'ADMIN')
  mark24QFiled(@Param('quarter') q: string, @Request() req: any, @Query('fy') fy: string) {
    return this.svc.mark24QFiled(req.user.companyId, fy || currentFY(), Number(q), req.user.sub);
  }

  // ── Form 16 ───────────────────────────────────────────────
  @Get('form16')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  listForm16(@Request() req: any, @Query('fy') fy: string) {
    return this.svc.listForm16(req.user.companyId, fy || currentFY());
  }

  @Post('form16/:employeeId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  generateForm16(@Param('employeeId') eid: string, @Request() req: any, @Query('fy') fy: string) {
    return this.svc.generateForm16(eid, req.user.companyId, fy || currentFY(), req.user.sub);
  }

  @Get('form16/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'EMPLOYEE')
  getForm16(@Param('id') id: string, @Request() req: any) {
    return this.svc.getForm16(id, req.user.companyId);
  }

  @Patch('form16/:id/esign')
  @Roles('SUPER_ADMIN', 'ADMIN')
  markEsigned(@Param('id') id: string, @Request() req: any) {
    return this.svc.markEsigned(id, req.user.companyId, req.user.sub);
  }
}

function currentFY(): string {
  const now = new Date();
  const yr  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${yr}-${String(yr + 1).slice(2)}`;
}
