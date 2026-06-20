import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private deptService: DepartmentsService) {}

  @Get()
  findAll(@Request() req: any) { return this.deptService.findAll(req.user.companyId); }

  @Get('tree')
  tree(@Request() req: any) { return this.deptService.tree(req.user.companyId); }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  create(@Request() req: any, @Body() body: any) { return this.deptService.create(req.user.companyId, body); }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.deptService.update(id, req.user.companyId, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.deptService.remove(id, req.user.companyId);
  }
}
