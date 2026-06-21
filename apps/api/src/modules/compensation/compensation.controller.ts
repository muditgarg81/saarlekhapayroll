import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompensationService } from './compensation.service';

@ApiTags('Compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compensation')
export class CompensationController {
  constructor(private svc: CompensationService) {}

  // ── Salary Revisions ──────────────────────────────────────
  @Get('revisions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  listRevisions(@Request() req: any, @Query('employeeId') employeeId?: string) {
    return this.svc.listRevisions(req.user.companyId, employeeId);
  }

  @Post('revisions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createRevision(@Request() req: any, @Body() body: any) {
    return this.svc.createRevision(req.user.companyId, req.user.sub, body);
  }

  // ── Perquisites ───────────────────────────────────────────
  @Get('perquisites')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  perquisites(@Request() req: any, @Query('fy') fy: string) {
    return this.svc.perquisiteSummary(req.user.companyId, fy);
  }

  @Post('perquisites')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createPerquisite(@Request() req: any, @Body() body: any) {
    return this.svc.createPerquisite(req.user.companyId, req.user.sub, body);
  }

  @Delete('perquisites/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deletePerquisite(@Param('id') id: string, @Request() req: any) {
    return this.svc.deletePerquisite(id, req.user.companyId, req.user.sub);
  }

  // ── Proof of Investment ───────────────────────────────────
  @Get('poi')
  listProofs(@Request() req: any, @Query() query: any) {
    return this.svc.listProofs(req.user.companyId, query);
  }

  @Post('poi')
  submitProof(@Request() req: any, @Body() body: any) {
    return this.svc.submitProof(req.user.companyId, req.user.sub, body);
  }

  @Patch('poi/:id/review')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  reviewProof(@Param('id') id: string, @Request() req: any, @Body() body: { status: 'VERIFIED' | 'REJECTED'; proofAmount?: number; comment?: string }) {
    return this.svc.reviewProof(id, req.user.companyId, req.user.sub, body.status, body.proofAmount, body.comment);
  }

  // ── Salary Withhold ───────────────────────────────────────
  @Get('holds')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  listHolds(@Request() req: any, @Query('status') status?: string) {
    return this.svc.listHolds(req.user.companyId, status);
  }

  @Post('holds')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  hold(@Request() req: any, @Body() body: any) {
    return this.svc.holdSalary(req.user.companyId, req.user.sub, body);
  }

  @Patch('holds/:id/release')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  release(@Param('id') id: string, @Request() req: any) {
    return this.svc.releaseSalary(id, req.user.companyId, req.user.sub);
  }
}
