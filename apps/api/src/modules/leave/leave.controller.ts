import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LeaveService } from './leave.service';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  // ── Policies ───────────────────────────────────────────────
  @Get('policies')
  getPolicies(@Request() req: any) {
    return this.leaveService.getPolicies(req.user.companyId);
  }

  @Post('policies')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createPolicy(@Request() req: any, @Body() body: any) {
    return this.leaveService.createPolicy(req.user.companyId, req.user.sub, body);
  }

  @Patch('policies/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  updatePolicy(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.leaveService.updatePolicy(id, req.user.companyId, req.user.sub, body);
  }

  @Delete('policies/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deletePolicy(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.deletePolicy(id, req.user.companyId, req.user.sub);
  }

  @Post('policies/seed-defaults')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  seedDefaultPolicies(@Request() req: any) {
    return this.leaveService.seedDefaultPolicies(req.user.companyId, req.user.sub);
  }

  // ── Balances ───────────────────────────────────────────────
  @Get('balances')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  getAllBalances(@Request() req: any, @Query('fy') fy: string) {
    const currentFY = currentFinancialYear();
    return this.leaveService.getAllBalances(req.user.companyId, fy || currentFY);
  }

  @Get('balances/:employeeId')
  getBalances(@Param('employeeId') employeeId: string, @Query('fy') fy: string) {
    return this.leaveService.getBalances(employeeId, fy || currentFinancialYear());
  }

  @Post('balances/initialize')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  initializeBalances(@Request() req: any, @Query('fy') fy: string) {
    return this.leaveService.initializeBalances(req.user.companyId, fy || currentFinancialYear(), req.user.sub);
  }

  @Post('balances/carry-forward')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  carryForward(@Request() req: any, @Body() body: { fromFY: string; toFY: string }) {
    return this.leaveService.processCarryForward(req.user.companyId, body.fromFY, body.toFY, req.user.sub);
  }

  @Post('balances/:employeeId/encash')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  encashLeave(@Param('employeeId') employeeId: string, @Request() req: any, @Body() body: any) {
    return this.leaveService.encashLeave(employeeId, req.user.companyId, req.user.sub, body);
  }

  // ── Applications ──────────────────────────────────────────
  @Post('apply')
  apply(@Request() req: any, @Body() body: any) {
    if (!req.user.employeeId) throw new BadRequestException('Your account is not linked to an employee record');
    return this.leaveService.apply(req.user.employeeId, req.user.companyId, body);
  }

  @Get('applications')
  getApplications(@Request() req: any, @Query() query: any) {
    return this.leaveService.getApplications({ ...query, companyId: req.user.companyId });
  }

  @Patch('applications/:id/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  review(@Param('id') id: string, @Request() req: any, @Body() body: { status: 'APPROVED' | 'REJECTED'; comment?: string }) {
    return this.leaveService.review(id, req.user.sub, body.status, body.comment);
  }

  @Patch('applications/:id/cancel')
  cancelApplication(@Param('id') id: string, @Request() req: any, @Body() body?: { reason?: string }) {
    return this.leaveService.cancelApplication(id, req.user.sub, req.user.companyId, body?.reason);
  }

  // ── Calendar ──────────────────────────────────────────────
  @Get('calendar')
  getTeamCalendar(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.leaveService.getTeamCalendar(req.user.companyId, Number(month || new Date().getMonth() + 1), Number(year || new Date().getFullYear()));
  }

  // ── Holidays ──────────────────────────────────────────────
  @Get('holidays')
  getHolidays(@Request() req: any, @Query('year') year: string) {
    return this.leaveService.getHolidays(req.user.companyId, Number(year || new Date().getFullYear()));
  }

  @Post('holidays')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createHoliday(@Request() req: any, @Body() body: any) {
    return this.leaveService.createHoliday(req.user.companyId, req.user.sub, body);
  }

  @Delete('holidays/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deleteHoliday(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.deleteHoliday(id, req.user.companyId, req.user.sub);
  }

  @Post('holidays/seed')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  seedHolidays(@Request() req: any, @Query('year') year: string, @Query('state') state?: string) {
    return this.leaveService.seedHolidays(req.user.companyId, req.user.sub, Number(year || new Date().getFullYear()), state);
  }
}

function currentFinancialYear(): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}
