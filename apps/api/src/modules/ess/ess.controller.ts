import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, Res, Header } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ESSService } from './ess.service';

@ApiTags('ESS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ess')
export class ESSController {
  constructor(private essService: ESSService) {}

  // ── Employee dashboard ────────────────────────────────────────
  @Get('dashboard')
  getDashboard(@Request() req: any) {
    if (!req.user.employeeId) return { employee: null };
    return this.essService.getDashboard(req.user.employeeId);
  }

  // ── Payslips ──────────────────────────────────────────────────
  @Get('payslips')
  getMyPayslips(@Request() req: any, @Query('year') year?: string) {
    if (!req.user.employeeId) return [];
    return this.essService.getMyPayslips(req.user.employeeId, year ? Number(year) : undefined);
  }

  @Get('payslips/:id')
  getPayslip(@Param('id') id: string, @Request() req: any) {
    return this.essService.getPayslipDetail(id, req.user.employeeId);
  }

  @Get('payslips/:id/pdf')
  async downloadPayslipPdf(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const html = await this.essService.generatePayslipHtml(id, req.user.employeeId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(html);
  }

  @Post('payslips/:id/whatsapp')
  sendWhatsApp(@Param('id') id: string, @Request() req: any) {
    return this.essService.sendPayslipWhatsApp(id, req.user.employeeId, req.user.companyId, req.user.sub);
  }

  @Get('whatsapp-logs')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  getWhatsAppLogs(@Request() req: any, @Query('employeeId') employeeId?: string) {
    return this.essService.getWhatsAppLogs(req.user.companyId, employeeId);
  }

  // ── IT Declaration ────────────────────────────────────────────
  @Get('tax/declaration')
  getDeclaration(@Request() req: any) {
    if (!req.user.employeeId) return null;
    return this.essService.getMyDeclaration(req.user.employeeId);
  }

  @Post('tax/declaration')
  saveDeclaration(@Request() req: any, @Body() body: any) {
    return this.essService.saveMyDeclaration(req.user.employeeId, req.user.companyId, body);
  }

  @Get('tax/worksheet')
  getTaxWorksheet(@Request() req: any) {
    if (!req.user.employeeId) return null;
    return this.essService.getTaxWorksheet(req.user.employeeId);
  }

  // ── Reimbursements (employee) ─────────────────────────────────
  @Get('reimbursements')
  getMyClaims(@Request() req: any) {
    if (!req.user.employeeId) return [];
    return this.essService.getMyClaims(req.user.employeeId);
  }

  @Post('reimbursements')
  submitClaim(@Request() req: any, @Body() body: any) {
    return this.essService.submitClaim(req.user.employeeId, req.user.companyId, body);
  }

  @Patch('reimbursements/:id/cancel')
  cancelClaim(@Param('id') id: string, @Request() req: any) {
    return this.essService.cancelClaim(id, req.user.employeeId);
  }

  // ── Reimbursements (HR) ───────────────────────────────────────
  @Get('reimbursements/all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  getAllClaims(@Request() req: any, @Query('status') status?: string) {
    return this.essService.getAllClaims(req.user.companyId, status);
  }

  @Patch('reimbursements/:id/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  reviewClaim(@Param('id') id: string, @Request() req: any, @Body() body: { status: 'APPROVED' | 'REJECTED'; comment?: string }) {
    return this.essService.reviewClaim(id, req.user.companyId, req.user.sub, body.status, body.comment);
  }

  @Patch('reimbursements/:id/mark-paid')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  markClaimPaid(@Param('id') id: string, @Request() req: any) {
    return this.essService.markClaimPaid(id, req.user.companyId, req.user.sub);
  }
}
