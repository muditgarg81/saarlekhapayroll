import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  create(@Request() req: any, @Body() body: CreateEmployeeDto) {
    return this.employeesService.create(req.user.companyId, body);
  }

  // ─── Documents ───────────────────────────────────────────
  @Get(':id/documents')
  listDocuments(@Param('id') id: string, @Request() req: any) {
    return this.employeesService.listDocuments(id, req.user.companyId);
  }

  @Post(':id/documents')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  addDocument(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.employeesService.addDocument(id, req.user.companyId, req.user.sub, body);
  }

  @Delete(':id/documents/:docId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  removeDocument(@Param('id') id: string, @Param('docId') docId: string, @Request() req: any) {
    return this.employeesService.removeDocument(id, docId, req.user.companyId);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: any) {
    return this.employeesService.findAll(req.user.companyId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.employeesService.findOne(id, req.user.companyId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.employeesService.update(id, req.user.companyId, body);
  }

  @Patch(':id/terminate')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  terminate(@Param('id') id: string, @Request() req: any, @Body() body: { dateOfLeaving: string }) {
    return this.employeesService.terminate(id, req.user.companyId, body.dateOfLeaving);
  }

  @Get(':id/salary-breakdown')
  salaryBreakdown(@Param('id') id: string, @Request() req: any) {
    return this.employeesService.getSalaryBreakdown(id, req.user.companyId);
  }

  @Post('bulk-import')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  bulkImport(@Request() req: any, @Body() body: { records: any[] }) {
    return this.employeesService.bulkImport(req.user.companyId, body.records);
  }
}
