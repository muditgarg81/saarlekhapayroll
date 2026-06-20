import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PayslipsService } from './payslips.service';

@ApiTags('Payslips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payslips')
export class PayslipsController {
  constructor(private payslipsService: PayslipsService) {}

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') empId: string, @Query('year') year?: string) {
    return this.payslipsService.findByEmployee(empId, year ? Number(year) : undefined);
  }

  @Get('my')
  findMine(@Request() req: any, @Query('year') year?: string) {
    if (!req.user.employeeId) return [];
    return this.payslipsService.findByEmployee(req.user.employeeId, year ? Number(year) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payslipsService.findOne(id);
  }
}
