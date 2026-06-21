import { Controller, Get, Post, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

function currentFY(): string {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear();
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('salary-register')
  salaryRegister(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getSalaryRegister(req.user.companyId, Number(month), Number(year));
  }

  @Get('cost')
  costReport(@Request() req: any, @Query('fromMonth') fm: string, @Query('fromYear') fy: string, @Query('toMonth') tm: string, @Query('toYear') ty: string) {
    return this.reportsService.getCostReport(req.user.companyId, Number(fm), Number(fy), Number(tm), Number(ty));
  }

  @Get('department-cost')
  departmentCost(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getDepartmentCost(req.user.companyId, Number(month), Number(year));
  }

  @Get('headcount')
  headcount(@Request() req: any) {
    return this.reportsService.getHeadcountReport(req.user.companyId);
  }

  @Get('challan/pf')
  pfChallan(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getPFChallan(req.user.companyId, Number(month), Number(year));
  }

  @Get('challan/esi')
  esiChallan(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getESIChallan(req.user.companyId, Number(month), Number(year));
  }

  @Get('challan/pt')
  ptChallan(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getPTChallan(req.user.companyId, Number(month), Number(year));
  }

  @Get('year-end-tax')
  yearEndTax(@Request() req: any, @Query('fy') fy: string) {
    return this.reportsService.getYearEndTaxReport(req.user.companyId, fy || currentFY());
  }

  @Get('fields')
  reportFields(@Request() req: any) {
    return this.reportsService.getReportFields(req.user.companyId);
  }

  @Get('payroll-liability')
  payrollLiability(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getPayrollLiability(req.user.companyId, Number(month), Number(year));
  }

  @Get('ecr')
  ecr(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getEcrFile(req.user.companyId, Number(month), Number(year));
  }

  @Get('annual-pt')
  annualPt(@Request() req: any, @Query('fy') fy: string) {
    return this.reportsService.getAnnualPT(req.user.companyId, fy || currentFY());
  }

  @Get('leave-encashment')
  leaveEncashment(@Request() req: any, @Query('fy') fy: string) {
    return this.reportsService.getLeaveEncashmentSummary(req.user.companyId, fy || currentFY());
  }

  @Get('variable-pay')
  variablePay(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getVariablePay(req.user.companyId, Number(month), Number(year));
  }

  @Get('donations')
  donations(@Request() req: any, @Query('fy') fy: string) {
    return this.reportsService.getDonationsSummary(req.user.companyId, fy || currentFY());
  }

  @Post('custom')
  customReport(@Request() req: any, @Body() body: any) {
    return this.reportsService.buildCustomReport(req.user.companyId, body);
  }

  @Get('templates')
  listTemplates(@Request() req: any) {
    return this.reportsService.listTemplates(req.user.companyId);
  }

  @Post('templates')
  saveTemplate(@Request() req: any, @Body() body: any) {
    return this.reportsService.saveTemplate(req.user.companyId, req.user.sub, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string, @Request() req: any) {
    return this.reportsService.deleteTemplate(id, req.user.companyId);
  }

  // legacy
  @Get('pf')
  pfReport(@Request() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.reportsService.getPFReport(req.user.companyId, Number(month), Number(year));
  }
}
