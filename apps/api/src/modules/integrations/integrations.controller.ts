import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('catalog')
  catalog() {
    return this.integrationsService.getCatalog();
  }

  @Get()
  list(@Request() req: any) {
    return this.integrationsService.list(req.user.companyId);
  }

  @Post(':provider/connect')
  @Roles('SUPER_ADMIN', 'ADMIN')
  connect(@Param('provider') provider: string, @Request() req: any, @Body() body: any) {
    return this.integrationsService.connect(req.user.companyId, req.user.sub, provider, body);
  }

  @Patch(':provider/disconnect')
  @Roles('SUPER_ADMIN', 'ADMIN')
  disconnect(@Param('provider') provider: string, @Request() req: any) {
    return this.integrationsService.disconnect(req.user.companyId, req.user.sub, provider);
  }

  @Post(':provider/test')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  test(@Param('provider') provider: string, @Request() req: any) {
    return this.integrationsService.testConnection(req.user.companyId, provider);
  }

  @Post(':provider/sync')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  sync(@Param('provider') provider: string, @Request() req: any, @Body() body: { operation: string }) {
    return this.integrationsService.sync(req.user.companyId, req.user.sub, provider, body.operation);
  }

  @Get('logs')
  logs(@Request() req: any, @Query('provider') provider?: string) {
    return this.integrationsService.getSyncLogs(req.user.companyId, provider);
  }
}
