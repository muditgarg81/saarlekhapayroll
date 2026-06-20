import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContractorService } from './contractor.service';

function currentFY(): string {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear();
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

@ApiTags('Contractor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contractor')
export class ContractorController {
  constructor(private contractorService: ContractorService) {}

  // ── Profiles ──────────────────────────────────────────────
  @Get('list')
  list(@Request() req: any, @Query('status') status?: string) {
    return this.contractorService.listContractors(req.user.companyId, status);
  }

  @Get('profile/:id')
  get(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.getContractor(id, req.user.companyId);
  }

  @Post('profile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  create(@Request() req: any, @Body() body: any) {
    return this.contractorService.createContractor(req.user.companyId, req.user.sub, body);
  }

  @Patch('profile/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.contractorService.updateContractor(id, req.user.companyId, req.user.sub, body);
  }

  @Delete('profile/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.deactivateContractor(id, req.user.companyId, req.user.sub);
  }

  // ── TDS preview ───────────────────────────────────────────
  @Post('tds-preview')
  preview(@Request() req: any, @Body() body: { contractorId: string; section?: string; grossAmount: number }) {
    return this.contractorService.previewPayment(req.user.companyId, body.contractorId, body.section, body.grossAmount);
  }

  // ── Payruns ───────────────────────────────────────────────
  @Get('payruns')
  listPayruns(@Request() req: any) {
    return this.contractorService.listPayruns(req.user.companyId);
  }

  @Get('payruns/:id')
  getPayrun(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.getPayrun(id, req.user.companyId);
  }

  @Post('payruns')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createPayrun(@Request() req: any, @Body() body: any) {
    return this.contractorService.createPayrun(req.user.companyId, req.user.sub, body);
  }

  @Patch('payruns/:id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  approvePayrun(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.approvePayrun(id, req.user.companyId, req.user.sub);
  }

  @Patch('payruns/:id/mark-paid')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  markPaid(@Param('id') id: string, @Request() req: any, @Body() body: { payDate?: string }) {
    return this.contractorService.markPayrunPaid(id, req.user.companyId, req.user.sub, body?.payDate);
  }

  @Patch('payruns/:id/cancel')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  cancelPayrun(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.cancelPayrun(id, req.user.companyId, req.user.sub);
  }

  // ── Form 16A ──────────────────────────────────────────────
  @Get('form16a')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  form16aSummary(@Request() req: any, @Query('fy') fy: string, @Query('quarter') quarter: string) {
    return this.contractorService.getForm16ASummary(req.user.companyId, fy || currentFY(), Number(quarter || 1));
  }

  @Post('form16a/:contractorId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  generateForm16a(@Param('contractorId') contractorId: string, @Request() req: any, @Query('fy') fy: string, @Query('quarter') quarter: string) {
    return this.contractorService.generateForm16A(contractorId, req.user.companyId, fy || currentFY(), Number(quarter || 1), req.user.sub);
  }

  @Patch('form16a/:id/esign')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  esignForm16a(@Param('id') id: string, @Request() req: any) {
    return this.contractorService.markForm16AEsigned(id, req.user.companyId, req.user.sub);
  }

  // ── TDS register ──────────────────────────────────────────
  @Get('tds-register')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  tdsRegister(@Request() req: any, @Query('fy') fy: string, @Query('quarter') quarter?: string) {
    return this.contractorService.tdsRegister(req.user.companyId, fy || currentFY(), quarter ? Number(quarter) : undefined);
  }
}
