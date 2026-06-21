import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IntegrationsService } from './integrations.service';
import { BiometricService } from './biometric.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private integrationsService: IntegrationsService,
    private biometric: BiometricService,
  ) {}

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

  // ── Biometric ─────────────────────────────────────────────
  @Get(':provider/device-endpoint')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  deviceEndpoint(@Param('provider') provider: string, @Request() req: any) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = process.env.API_PUBLIC_URL || `${proto}://${host}`;
    return this.biometric.getDeviceEndpoint(req.user.companyId, provider, baseUrl);
  }

  @Post(':provider/punch-upload')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  punchUpload(@Param('provider') provider: string, @Request() req: any, @Body() body: { content: string }) {
    return this.biometric.manualUpload(req.user.companyId, req.user.sub, provider, body.content);
  }
}
