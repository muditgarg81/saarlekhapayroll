import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // ── Shifts ────────────────────────────────────────────────
  @Get('shifts')
  getShifts(@Request() req: any) {
    return this.attendanceService.getShifts(req.user.companyId);
  }

  @Post('shifts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createShift(@Request() req: any, @Body() body: any) {
    return this.attendanceService.createShift(req.user.companyId, req.user.sub, body);
  }

  @Patch('shifts/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  updateShift(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.attendanceService.updateShift(id, req.user.companyId, req.user.sub, body);
  }

  @Delete('shifts/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deleteShift(@Param('id') id: string, @Request() req: any) {
    return this.attendanceService.deleteShift(id, req.user.companyId, req.user.sub);
  }

  // ── Roster ────────────────────────────────────────────────
  @Get('roster')
  getRoster(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    const now = new Date();
    return this.attendanceService.getRoster(req.user.companyId, Number(month || now.getMonth() + 1), Number(year || now.getFullYear()));
  }

  @Post('roster/assign')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  assignShift(@Request() req: any, @Body() body: any) {
    return this.attendanceService.assignShift(req.user.companyId, req.user.sub, body);
  }

  @Delete('roster/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deleteRosterEntry(@Param('id') id: string, @Request() req: any) {
    return this.attendanceService.deleteRosterEntry(id, req.user.companyId, req.user.sub);
  }

  // ── Mark / Import ─────────────────────────────────────────
  @Post('mark')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  mark(@Body() body: any) {
    return this.attendanceService.markAttendance(body.employeeId, body);
  }

  @Post('bulk-import')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  bulkImport(@Body() body: { records: any[] }) {
    return this.attendanceService.bulkImport(body.records);
  }

  @Post('biometric-import')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  biometricImport(@Request() req: any, @Body() body: { csv: string }) {
    return this.attendanceService.biometricImport(req.user.companyId, req.user.sub, body.csv);
  }

  @Post('auto-seed')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  autoSeed(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    const now = new Date();
    return this.attendanceService.autoSeedMonth(req.user.companyId, req.user.sub, Number(month || now.getMonth() + 1), Number(year || now.getFullYear()));
  }

  // ── Query ─────────────────────────────────────────────────
  @Get('report/monthly')
  getMonthlyReport(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.attendanceService.getMonthlyReport(req.user.companyId, Number(month), Number(year));
  }

  @Get(':employeeId')
  getAttendance(
    @Param('employeeId') empId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.attendanceService.getAttendance(empId, Number(month), Number(year));
  }

  // ── Regularization ────────────────────────────────────────
  @Post('regularization')
  applyRegularization(@Request() req: any, @Body() body: any) {
    return this.attendanceService.applyRegularization(req.user.employeeId || body.employeeId, req.user.companyId, body);
  }

  @Get('regularizations/list')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  getRegularizations(@Request() req: any, @Query() query: any) {
    return this.attendanceService.getRegularizations(req.user.companyId, query);
  }

  @Patch('regularizations/:id/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  reviewRegularization(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; comment?: string },
  ) {
    return this.attendanceService.reviewRegularization(id, req.user.companyId, req.user.sub, body.status, body.comment);
  }
}
