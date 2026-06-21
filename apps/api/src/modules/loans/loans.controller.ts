import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LoansService } from './loans.service';

function currentFY(): string {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear();
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private loans: LoansService) {}

  @Get()
  list(@Request() req: any, @Query('status') status?: string) {
    return this.loans.listLoans(req.user.companyId, status);
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  summary(@Request() req: any) {
    return this.loans.loanSummary(req.user.companyId);
  }

  @Get('perquisite')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  perquisite(@Request() req: any, @Query('fy') fy: string, @Query('projected') projected?: string) {
    return this.loans.perquisiteSummary(req.user.companyId, fy || currentFY(), projected === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: any) {
    return this.loans.getLoan(id, req.user.companyId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  create(@Request() req: any, @Body() body: any) {
    return this.loans.createLoan(req.user.companyId, req.user.sub, body);
  }

  @Patch(':id/installments/:no/post')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  postInstallment(@Param('id') id: string, @Param('no') no: string, @Request() req: any, @Body() body: { payslipId?: string }) {
    return this.loans.postInstallment(id, req.user.companyId, req.user.sub, Number(no), body?.payslipId);
  }

  @Patch(':id/cancel')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.loans.cancelLoan(id, req.user.companyId, req.user.sub);
  }
}
