import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BankService } from './bank.service';

@ApiTags('Bank')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
@Controller('bank')
export class BankController {
  constructor(private svc: BankService) {}

  @Post('advice')
  generate(@Request() req: any, @Body() body: { payrunId: string; mode?: string; bankName?: string; accountNo?: string; ifscCode?: string }) {
    return this.svc.generateAdvice(body.payrunId, req.user.companyId, req.user.sub, body);
  }

  @Get('advice')
  list(@Request() req: any, @Query('status') status?: string, @Query('payrunId') payrunId?: string) {
    return this.svc.listAdvices(req.user.companyId, { status, payrunId });
  }

  @Get('advice/:id')
  getOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.getAdvice(id, req.user.companyId);
  }

  @Get('advice/:id/download')
  async download(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const file = await this.svc.getAdviceFile(id, req.user.companyId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  @Patch('advice/:id/upload')
  markUploaded(@Param('id') id: string, @Request() req: any) {
    return this.svc.markUploaded(id, req.user.companyId, req.user.sub);
  }

  @Get('advice/:id/bank-summary')
  bankSummary(@Param('id') id: string, @Request() req: any) {
    return this.svc.bankWiseSummary(id, req.user.companyId);
  }

  @Patch('advice/:id/transactions/:txId')
  updateTx(
    @Param('id') id: string,
    @Param('txId') txId: string,
    @Request() req: any,
    @Body() body: { status: string; utr?: string; failureReason?: string },
  ) {
    return this.svc.updateTransactionStatus(id, txId, req.user.companyId, req.user.sub, body);
  }

  @Post('advice/:id/bulk-utr')
  bulkUTR(@Param('id') id: string, @Request() req: any, @Body() body: { csv: string }) {
    return this.svc.bulkUpdateUTR(id, req.user.companyId, req.user.sub, body.csv);
  }

  @Get('payrun/:payrunId/summary')
  payrunSummary(@Param('payrunId') pid: string, @Request() req: any) {
    return this.svc.payrunPaymentSummary(pid, req.user.companyId);
  }
}
