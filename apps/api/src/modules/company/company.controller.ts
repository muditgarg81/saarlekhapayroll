import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompanyService } from './company.service';

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company')
export class CompanyController {
  constructor(private companyService: CompanyService) {}

  @Get()
  findOne(@Request() req: any) {
    return this.companyService.findOne(req.user.companyId);
  }

  @Patch()
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Request() req: any, @Body() body: any) {
    return this.companyService.update(req.user.companyId, body);
  }

  @Get('dashboard')
  dashboard(@Request() req: any) {
    return this.companyService.getDashboard(req.user.companyId);
  }
}
