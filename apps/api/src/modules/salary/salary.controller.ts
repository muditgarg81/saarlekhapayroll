import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SalaryService } from './salary.service';

@ApiTags('Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private salaryService: SalaryService) {}

  // ── Components ────────────────────────────────────────────
  @Post('components/seed')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  seedDefaults(@Request() req: any) {
    return this.salaryService.seedDefaultComponents(req.user.companyId);
  }

  @Get('components')
  getComponents(@Request() req: any) {
    return this.salaryService.getComponents(req.user.companyId);
  }

  @Post('components')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createComponent(@Request() req: any, @Body() body: any) {
    return this.salaryService.createComponent(req.user.companyId, body);
  }

  @Patch('components/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  updateComponent(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.salaryService.updateComponent(id, req.user.companyId, body);
  }

  @Delete('components/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deactivateComponent(@Param('id') id: string, @Request() req: any) {
    return this.salaryService.deactivateComponent(id, req.user.companyId);
  }

  // ── Structures ────────────────────────────────────────────
  @Get('structures')
  getStructures(@Request() req: any) {
    return this.salaryService.getStructures(req.user.companyId);
  }

  @Post('structures')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  createStructure(@Request() req: any, @Body() body: any) {
    return this.salaryService.createStructure(req.user.companyId, body);
  }

  @Patch('structures/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  updateStructure(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.salaryService.updateStructure(id, req.user.companyId, body);
  }

  @Delete('structures/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deactivateStructure(@Param('id') id: string, @Request() req: any) {
    return this.salaryService.deactivateStructure(id, req.user.companyId);
  }

  // ── Simulator ─────────────────────────────────────────────
  @Post('simulate')
  simulate(@Request() req: any, @Body() body: { structureId: string; ctc: number }) {
    return this.salaryService.simulate(req.user.companyId, body);
  }
}
