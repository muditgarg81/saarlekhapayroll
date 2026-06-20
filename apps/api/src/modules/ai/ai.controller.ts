import { Controller, Get, Post, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiService } from './ai.service';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('status')
  status() {
    return this.aiService.isConfigured();
  }

  @Post('query')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER')
  query(@Request() req: any, @Body() body: { question: string }) {
    return this.aiService.query(req.user.companyId, req.user.sub, body.question);
  }

  @Get('anomalies')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  anomalies(@Request() req: any, @Query('month') month: string, @Query('year') year: string, @Query('threshold') threshold?: string) {
    return this.aiService.detectAnomalies(req.user.companyId, Number(month), Number(year), threshold ? Number(threshold) : undefined);
  }

  @Post('anomalies/explain')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  explainAnomalies(@Request() req: any, @Body() body: { month: number; year: number }) {
    return this.aiService.explainAnomalies(req.user.companyId, req.user.sub, body.month, body.year);
  }

  @Get('tax-optimization/:employeeId')
  taxOptimization(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.aiService.taxOptimization(employeeId, req.user.companyId);
  }

  @Get('tax-optimization')
  myTaxOptimization(@Request() req: any) {
    return this.aiService.taxOptimization(req.user.employeeId, req.user.companyId);
  }

  @Post('chat')
  chat(@Request() req: any, @Body() body: { messages: { role: 'user' | 'assistant'; content: string }[] }) {
    return this.aiService.chat(req.user.companyId, req.user.employeeId || null, body.messages);
  }
}
