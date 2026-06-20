import { Controller, Get, Post, Param, Body, Request, UseGuards, Query, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayrunService } from './payrun.service';

@ApiTags('Payrun')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payrun')
export class PayrunController {
  constructor(private payrunService: PayrunService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  create(@Request() req: any, @Body() body: any) {
    return this.payrunService.create(req.user.companyId, req.user.sub, body);
  }

  @Post('fnf')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createFnF(@Request() req: any, @Body() body: any) {
    return this.payrunService.createFnF(req.user.companyId, req.user.sub, body);
  }

  @Get(':id/preview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  preview(@Param('id') id: string, @Request() req: any) {
    return this.payrunService.preview(id, req.user.companyId);
  }

  @Post(':id/process')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  process(@Param('id') id: string, @Request() req: any) {
    return this.payrunService.process(id, req.user.companyId, req.user.sub);
  }

  @Patch(':id/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  review(@Param('id') id: string, @Request() req: any, @Body() body: { notes?: string }) {
    return this.payrunService.review(id, req.user.companyId, req.user.sub, body.notes);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  approve(@Param('id') id: string, @Request() req: any) {
    return this.payrunService.approve(id, req.user.companyId, req.user.sub);
  }

  @Patch(':id/mark-paid')
  @Roles('SUPER_ADMIN', 'ADMIN')
  markPaid(@Param('id') id: string, @Request() req: any) {
    return this.payrunService.markPaid(id, req.user.companyId, req.user.sub);
  }

  @Patch(':id/cancel')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  cancel(@Param('id') id: string, @Request() req: any, @Body() body: { reason?: string }) {
    return this.payrunService.cancel(id, req.user.companyId, req.user.sub, body.reason);
  }

  @Patch(':id/payslips/:payslipId/override')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  overridePayslip(
    @Param('id') id: string,
    @Param('payslipId') payslipId: string,
    @Request() req: any,
    @Body() body: { overrides: Record<string, number>; note?: string },
  ) {
    return this.payrunService.overridePayslip(id, payslipId, req.user.companyId, req.user.sub, body);
  }

  @Get()
  findAll(@Request() req: any, @Query('year') year?: string, @Query('month') month?: string, @Query('type') type?: string) {
    return this.payrunService.findAll(req.user.companyId, {
      year:  year  ? Number(year)  : undefined,
      month: month ? Number(month) : undefined,
      type,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.payrunService.findOne(id, req.user.companyId);
  }
}
