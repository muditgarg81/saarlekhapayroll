import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('catalog')
  catalog() {
    return this.notifications.getCatalog();
  }

  // ── Channels ──────────────────────────────────────────────
  @Get('channels')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  listChannels(@Request() req: any) {
    return this.notifications.listChannels(req.user.companyId);
  }

  @Post('channels/:channel')
  @Roles('SUPER_ADMIN', 'ADMIN')
  saveChannel(@Param('channel') channel: string, @Request() req: any, @Body() body: any) {
    return this.notifications.saveChannel(req.user.companyId, req.user.sub, channel.toUpperCase(), body);
  }

  @Patch('channels/:channel/toggle')
  @Roles('SUPER_ADMIN', 'ADMIN')
  toggleChannel(@Param('channel') channel: string, @Request() req: any, @Body() body: { enabled: boolean }) {
    return this.notifications.toggleChannel(req.user.companyId, req.user.sub, channel.toUpperCase(), body.enabled);
  }

  @Post('channels/:channel/test')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  test(@Param('channel') channel: string, @Request() req: any, @Body() body: { recipient: string }) {
    return this.notifications.sendTest(req.user.companyId, req.user.sub, channel.toUpperCase() as any, body.recipient);
  }

  // ── Reminders & compliance ────────────────────────────────
  @Get('payrun-reminders')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  payrunReminders(@Request() req: any) {
    return this.notifications.payrunReminders(req.user.companyId, req.user.sub, false);
  }

  @Post('payrun-reminders/send')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  sendPayrunReminders(@Request() req: any) {
    return this.notifications.payrunReminders(req.user.companyId, req.user.sub, true);
  }

  @Get('compliance-calendar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  complianceCalendar(@Request() req: any) {
    return this.notifications.complianceCalendar(req.user.companyId, req.user.sub, false);
  }

  @Post('compliance-calendar/send')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  sendComplianceAlerts(@Request() req: any) {
    return this.notifications.complianceCalendar(req.user.companyId, req.user.sub, true);
  }

  // ── Manual triggers ───────────────────────────────────────
  @Post('approval-request/:payrunId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  approvalRequest(@Param('payrunId') payrunId: string, @Request() req: any) {
    return this.notifications.notifyApprovalRequest(req.user.companyId, req.user.sub, payrunId);
  }

  @Post('broadcast')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER')
  broadcast(@Request() req: any, @Body() body: any) {
    return this.notifications.sendCustom(req.user.companyId, req.user.sub, body);
  }

  // ── Log ───────────────────────────────────────────────────
  @Get('stats')
  stats(@Request() req: any) {
    return this.notifications.stats(req.user.companyId);
  }

  @Get()
  list(@Request() req: any, @Query() query: any) {
    return this.notifications.list(req.user.companyId, { ...query, page: query.page ? Number(query.page) : 1 });
  }
}
