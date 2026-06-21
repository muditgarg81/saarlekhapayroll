import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';
const CHANNELS: Channel[] = ['EMAIL', 'SMS', 'WHATSAPP'];
const MASK = '••••••••';

export interface ChannelProviderDef {
  channel: Channel;
  providers: { key: string; label: string; fields: { key: string; label: string; secret?: boolean }[] }[];
}

export const CHANNEL_CATALOG: ChannelProviderDef[] = [
  {
    channel: 'EMAIL',
    providers: [
      { key: 'SENDGRID', label: 'SendGrid', fields: [{ key: 'apiKey', label: 'API Key', secret: true }] },
      { key: 'SMTP', label: 'SMTP', fields: [{ key: 'host', label: 'Host' }, { key: 'port', label: 'Port' }, { key: 'username', label: 'Username' }, { key: 'password', label: 'Password', secret: true }] },
    ],
  },
  {
    channel: 'SMS',
    providers: [
      { key: 'MSG91', label: 'MSG91', fields: [{ key: 'authKey', label: 'Auth Key', secret: true }, { key: 'senderId', label: 'Sender ID' }, { key: 'dltTemplateId', label: 'DLT Template ID' }] },
      { key: 'TWILIO', label: 'Twilio', fields: [{ key: 'accountSid', label: 'Account SID' }, { key: 'authToken', label: 'Auth Token', secret: true }] },
      { key: 'KALEYRA', label: 'Kaleyra', fields: [{ key: 'apiKey', label: 'API Key', secret: true }, { key: 'senderId', label: 'Sender ID' }] },
    ],
  },
  {
    channel: 'WHATSAPP',
    providers: [
      { key: 'INTERAKT', label: 'Interakt', fields: [{ key: 'apiKey', label: 'API Key', secret: true }] },
      { key: 'GUPSHUP', label: 'Gupshup', fields: [{ key: 'apiKey', label: 'API Key', secret: true }, { key: 'sourceNumber', label: 'Source Number' }] },
      { key: 'TWILIO', label: 'Twilio WhatsApp', fields: [{ key: 'accountSid', label: 'Account SID' }, { key: 'authToken', label: 'Auth Token', secret: true }, { key: 'fromNumber', label: 'From (whatsapp:+…)' }] },
    ],
  },
];

// Event types the system can emit
export const EVENT_TYPES = [
  { key: 'PAYRUN_REMINDER', label: 'Payrun Reminder', audience: 'ADMIN' },
  { key: 'COMPLIANCE_DEADLINE', label: 'Compliance Deadline', audience: 'ADMIN' },
  { key: 'APPROVAL_REQUEST', label: 'Approval Request', audience: 'APPROVER' },
  { key: 'APPROVAL_RESULT', label: 'Approval Result', audience: 'REQUESTER' },
  { key: 'LEAVE_STATUS', label: 'Leave Status Update', audience: 'EMPLOYEE' },
  { key: 'PAYSLIP_PUBLISHED', label: 'Payslip Published', audience: 'EMPLOYEE' },
];

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── Channel config ────────────────────────────────────────────────────────
  getCatalog() { return { channels: CHANNEL_CATALOG, events: EVENT_TYPES }; }

  private _maskConfig(channel: string, provider: string, config: any) {
    if (!config) return config;
    const def = CHANNEL_CATALOG.find(c => c.channel === channel)?.providers.find(p => p.key === provider);
    const secrets = new Set(def?.fields.filter(f => f.secret).map(f => f.key));
    const out: any = {};
    for (const [k, v] of Object.entries(config)) out[k] = secrets.has(k) && v ? MASK : v;
    return out;
  }

  async listChannels(companyId: string) {
    const rows = await this.prisma.notificationChannel.findMany({ where: { companyId } });
    return CHANNELS.map(ch => {
      const existing = rows.find(r => r.channel === ch);
      return {
        channel: ch,
        id: existing?.id ?? null,
        provider: existing?.provider ?? null,
        fromName: existing?.fromName ?? null,
        fromAddress: existing?.fromAddress ?? null,
        enabled: existing?.enabled ?? false,
        config: existing ? this._maskConfig(ch, existing.provider, existing.config) : null,
        providers: CHANNEL_CATALOG.find(c => c.channel === ch)?.providers ?? [],
      };
    });
  }

  async saveChannel(companyId: string, actorId: string, channel: string, dto: { provider: string; fromName?: string; fromAddress?: string; config?: any; enabled?: boolean }) {
    if (!CHANNELS.includes(channel as Channel)) throw new BadRequestException('Invalid channel');
    const existing = await this.prisma.notificationChannel.findUnique({ where: { companyId_channel: { companyId, channel } } });

    // keep masked secrets
    const merged = { ...(existing?.config as any || {}) };
    for (const [k, v] of Object.entries(dto.config || {})) { if (v === MASK) continue; merged[k] = v; }

    const saved = await this.prisma.notificationChannel.upsert({
      where: { companyId_channel: { companyId, channel } },
      update: { provider: dto.provider, fromName: dto.fromName, fromAddress: dto.fromAddress, config: merged, enabled: dto.enabled ?? existing?.enabled ?? false },
      create: { companyId, channel, provider: dto.provider, fromName: dto.fromName, fromAddress: dto.fromAddress, config: merged, enabled: dto.enabled ?? false, createdBy: actorId },
    });
    await this.audit.log(actorId, companyId, 'UPDATE', 'NotificationChannel', saved.id, `${channel} channel ${saved.enabled ? 'enabled' : 'saved'} (${dto.provider})`);
    return { ...saved, config: this._maskConfig(channel, saved.provider, saved.config) };
  }

  async toggleChannel(companyId: string, actorId: string, channel: string, enabled: boolean) {
    const existing = await this.prisma.notificationChannel.findUnique({ where: { companyId_channel: { companyId, channel } } });
    if (!existing) throw new NotFoundException('Channel not configured');
    const saved = await this.prisma.notificationChannel.update({ where: { id: existing.id }, data: { enabled } });
    await this.audit.log(actorId, companyId, 'UPDATE', 'NotificationChannel', saved.id, `${channel} channel ${enabled ? 'enabled' : 'disabled'}`);
    return saved;
  }

  // ── Core dispatch ─────────────────────────────────────────────────────────
  /**
   * Queue + dispatch a single message. Senders are wired to log+stub by default
   * and degrade gracefully when the channel is disabled/unconfigured.
   */
  async send(companyId: string, params: {
    channel: Channel; eventType: string; recipient: string; recipientName?: string;
    subject?: string; body: string; employeeId?: string; userId?: string; relatedEntity?: string; relatedId?: string;
  }) {
    const channelCfg = await this.prisma.notificationChannel.findUnique({ where: { companyId_channel: { companyId, channel: params.channel } } });

    const base = {
      companyId, channel: params.channel, eventType: params.eventType,
      recipient: params.recipient, recipientName: params.recipientName,
      subject: params.subject, body: params.body,
      employeeId: params.employeeId, userId: params.userId,
      relatedEntity: params.relatedEntity, relatedId: params.relatedId,
    };

    if (!params.recipient) {
      return this.prisma.notification.create({ data: { ...base, status: 'SKIPPED', error: 'No recipient address' } });
    }
    if (!channelCfg || !channelCfg.enabled) {
      return this.prisma.notification.create({ data: { ...base, status: 'SKIPPED', error: `${params.channel} channel not enabled` } });
    }

    const notif = await this.prisma.notification.create({ data: { ...base, status: 'QUEUED' } });
    try {
      const providerMsgId = await this._dispatch(channelCfg, params);
      return this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'SENT', sentAt: new Date(), providerMsgId } });
    } catch (err: any) {
      return this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'FAILED', error: err.message } });
    }
  }

  /** Provider dispatch. Real SDK/HTTP calls go here per provider; stubbed to succeed. */
  private async _dispatch(channelCfg: any, _params: any): Promise<string> {
    // e.g. SendGrid/SMTP for EMAIL; MSG91/Twilio for SMS; Interakt/Gupshup for WHATSAPP.
    // Returns a provider message id. Throws on failure.
    return `${channelCfg.provider.toLowerCase()}-${Date.now()}`;
  }

  /** Fan a message out across all enabled channels for a recipient. */
  async sendMulti(companyId: string, channels: Channel[], params: Omit<Parameters<NotificationsService['send']>[1], 'channel' | 'recipient'> & { email?: string; phone?: string }) {
    const results = [];
    for (const ch of channels) {
      const recipient = ch === 'EMAIL' ? params.email : params.phone;
      results.push(await this.send(companyId, { ...params, channel: ch, recipient: recipient || '' }));
    }
    return results;
  }

  // ── Templates (rendered server-side) ──────────────────────────────────────
  private render(tpl: string, vars: Record<string, string | number>) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
  }

  // ── Event helpers ─────────────────────────────────────────────────────────
  async notifyApprovalRequest(companyId: string, actorId: string, payrunId: string) {
    const payrun = await this.prisma.payrun.findFirst({ where: { id: payrunId, companyId } });
    if (!payrun) throw new NotFoundException('Payrun not found');
    const M = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    // approvers = admins/HR who didn't create it
    const approvers = await this.prisma.user.findMany({ where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] }, id: { not: payrun.createdBy }, isActive: true }, include: { employee: { select: { phone: true, firstName: true } } } });
    const body = `Payrun ${M[payrun.month]} ${payrun.year} is awaiting your approval. Net ₹${Math.round(payrun.totalNetPay).toLocaleString('en-IN')} for ${payrun.totalEmployees} employees.`;
    let sent = 0;
    for (const u of approvers) {
      await this.sendMulti(companyId, ['EMAIL', 'WHATSAPP'], {
        eventType: 'APPROVAL_REQUEST', subject: `Payrun approval needed — ${M[payrun.month]} ${payrun.year}`, body,
        recipientName: u.employee?.firstName, userId: u.id, email: u.email, phone: u.employee?.phone,
        relatedEntity: 'Payrun', relatedId: payrun.id,
      });
      sent++;
    }
    await this.audit.log(actorId, companyId, 'CREATE', 'Notification', null, `Approval request sent to ${sent} approver(s) for payrun ${M[payrun.month]} ${payrun.year}`);
    return { approversNotified: sent };
  }

  async notifyLeaveStatus(companyId: string, applicationId: string) {
    const app = await this.prisma.leaveApplication.findFirst({ where: { id: applicationId }, include: { employee: { select: { id: true, email: true, phone: true, firstName: true, companyId: true } } } });
    if (!app || app.employee.companyId !== companyId) throw new NotFoundException('Application not found');
    const body = `Your leave request (${app.leaveType}, ${new Date(app.fromDate).toLocaleDateString('en-IN')}–${new Date(app.toDate).toLocaleDateString('en-IN')}) is now ${app.status}.${app.reviewComment ? ` Note: ${app.reviewComment}` : ''}`;
    await this.sendMulti(companyId, ['EMAIL', 'SMS', 'WHATSAPP'], {
      eventType: 'LEAVE_STATUS', subject: `Leave ${app.status.toLowerCase()}`, body,
      recipientName: app.employee.firstName, employeeId: app.employee.id, email: app.employee.email, phone: app.employee.phone,
      relatedEntity: 'LeaveApplication', relatedId: app.id,
    });
    return { sent: true, status: app.status };
  }

  // ── Payrun reminders ──────────────────────────────────────────────────────
  /** Returns upcoming payrun obligations and (optionally) sends reminders to admins. */
  async payrunReminders(companyId: string, actorId: string, dispatch = false) {
    const now = new Date();
    const month = now.getMonth() + 1, year = now.getFullYear();
    const existing = await this.prisma.payrun.findFirst({ where: { companyId, month, year, type: 'REGULAR' } });
    const dayOfMonth = now.getDate();

    const items: { title: string; detail: string; due: string; severity: string }[] = [];
    if (!existing) {
      items.push({ title: 'Run payroll', detail: `No regular payrun created for ${monthName(month)} ${year}`, due: `${year}-${String(month).padStart(2,'0')}-28`, severity: dayOfMonth >= 25 ? 'high' : 'medium' });
    } else if (['DRAFT', 'PENDING_REVIEW'].includes(existing.status)) {
      items.push({ title: 'Complete payroll', detail: `${monthName(month)} ${year} payrun is still ${existing.status}`, due: `${year}-${String(month).padStart(2,'0')}-28`, severity: 'medium' });
    } else if (existing.status === 'PENDING_APPROVAL') {
      items.push({ title: 'Approve payroll', detail: `${monthName(month)} ${year} payrun awaits approval`, due: `${year}-${String(month).padStart(2,'0')}-28`, severity: 'high' });
    } else if (existing.status === 'APPROVED') {
      items.push({ title: 'Disburse & mark paid', detail: `${monthName(month)} ${year} payrun approved — release payment`, due: `${year}-${String(month).padStart(2,'0')}-30`, severity: 'medium' });
    }

    let notified = 0;
    if (dispatch && items.length) {
      const admins = await this.prisma.user.findMany({ where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] }, isActive: true }, include: { employee: { select: { phone: true, firstName: true } } } });
      const body = items.map(i => `• ${i.title}: ${i.detail}`).join('\n');
      for (const u of admins) {
        await this.sendMulti(companyId, ['EMAIL', 'WHATSAPP'], { eventType: 'PAYRUN_REMINDER', subject: `Payroll reminder — ${monthName(month)} ${year}`, body, recipientName: u.employee?.firstName, userId: u.id, email: u.email, phone: u.employee?.phone, relatedEntity: 'Payrun' });
        notified++;
      }
      await this.audit.log(actorId, companyId, 'CREATE', 'Notification', null, `Payrun reminders sent to ${notified} admin(s)`);
    }
    return { items, notified };
  }

  // ── Compliance deadline calendar ──────────────────────────────────────────
  /** Statutory due dates for the current cycle with days remaining. */
  async complianceCalendar(companyId: string, actorId: string, dispatch = false) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1; // current month
    const due = (yy: number, mm: number, dd: number) => new Date(yy, mm - 1, dd);
    const daysLeft = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / 86400000);

    // monthly statutory dues are for the PRIOR month's payroll, payable this month
    const items = [
      { key: 'TDS_PAYMENT', label: 'TDS Payment (Challan 281)', date: due(y, m, 7), authority: 'Income Tax' },
      { key: 'PF_ECR',      label: 'PF ECR Filing & Payment',   date: due(y, m, 15), authority: 'EPFO' },
      { key: 'ESI',         label: 'ESI Contribution',          date: due(y, m, 15), authority: 'ESIC' },
      { key: 'PT',          label: 'Professional Tax Return',    date: due(y, m, 21), authority: 'State' },
    ];

    // quarterly TDS returns (24Q)
    const q = [{ q: 1, date: due(y, 7, 31) }, { q: 2, date: due(y, 10, 31) }, { q: 3, date: due(y + 1, 1, 31) }, { q: 4, date: due(y, 5, 31) }];
    for (const item of q) {
      const dl = daysLeft(item.date);
      if (dl >= 0 && dl <= 45) items.push({ key: `TDS_24Q_Q${item.q}`, label: `TDS Return 24Q (Q${item.q})`, date: item.date, authority: 'TRACES' });
    }

    const enriched = items
      .map(i => {
        const dl = daysLeft(i.date);
        return { ...i, dueDate: i.date.toISOString().split('T')[0], daysLeft: dl, severity: dl < 0 ? 'overdue' : dl <= 3 ? 'high' : dl <= 7 ? 'medium' : 'low' };
      })
      .filter(i => i.daysLeft >= -3) // hide long-past
      .sort((a, b) => a.daysLeft - b.daysLeft);

    let notified = 0;
    if (dispatch) {
      const urgent = enriched.filter(i => i.daysLeft <= 7);
      if (urgent.length) {
        const admins = await this.prisma.user.findMany({ where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] }, isActive: true }, include: { employee: { select: { phone: true, firstName: true } } } });
        const body = urgent.map(i => `• ${i.label}: due ${i.dueDate} (${i.daysLeft < 0 ? `${-i.daysLeft}d overdue` : `${i.daysLeft}d left`})`).join('\n');
        for (const u of admins) {
          await this.sendMulti(companyId, ['EMAIL', 'WHATSAPP'], { eventType: 'COMPLIANCE_DEADLINE', subject: 'Upcoming compliance deadlines', body, recipientName: u.employee?.firstName, userId: u.id, email: u.email, phone: u.employee?.phone, relatedEntity: 'Compliance' });
          notified++;
        }
        await this.audit.log(actorId, companyId, 'CREATE', 'Notification', null, `Compliance alerts sent to ${notified} admin(s) for ${urgent.length} deadline(s)`);
      }
    }
    return { items: enriched, notified };
  }

  // ── Manual / test send ────────────────────────────────────────────────────
  async sendTest(companyId: string, actorId: string, channel: Channel, recipient: string) {
    const res = await this.send(companyId, { channel, eventType: 'CUSTOM', recipient, subject: 'Test notification', body: 'This is a test message from Saarlekha Payroll notifications.' });
    await this.audit.log(actorId, companyId, 'CREATE', 'Notification', res.id, `Test ${channel} sent to ${recipient}`);
    return res;
  }

  async sendCustom(companyId: string, actorId: string, dto: { channels: Channel[]; recipientFilter: 'ALL_EMPLOYEES' | 'ALL_ADMINS'; subject?: string; body: string }) {
    if (!dto.body?.trim()) throw new BadRequestException('Message body is required');
    let sent = 0;
    if (dto.recipientFilter === 'ALL_EMPLOYEES') {
      const emps = await this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true, email: true, phone: true, firstName: true } });
      for (const e of emps) { await this.sendMulti(companyId, dto.channels, { eventType: 'CUSTOM', subject: dto.subject, body: this.render(dto.body, { name: e.firstName }), recipientName: e.firstName, employeeId: e.id, email: e.email, phone: e.phone }); sent++; }
    } else {
      const admins = await this.prisma.user.findMany({ where: { companyId, role: { in: ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'] }, isActive: true }, include: { employee: { select: { phone: true, firstName: true } } } });
      for (const u of admins) { await this.sendMulti(companyId, dto.channels, { eventType: 'CUSTOM', subject: dto.subject, body: dto.body, recipientName: u.employee?.firstName, userId: u.id, email: u.email, phone: u.employee?.phone }); sent++; }
    }
    await this.audit.log(actorId, companyId, 'CREATE', 'Notification', null, `Custom broadcast to ${sent} ${dto.recipientFilter === 'ALL_EMPLOYEES' ? 'employees' : 'admins'} via ${dto.channels.join('/')}`);
    return { recipients: sent };
  }

  // ── Log / history ─────────────────────────────────────────────────────────
  async list(companyId: string, filters: { channel?: string; eventType?: string; status?: string; page?: number }) {
    const page = filters.page ?? 1, limit = 50;
    const where: any = { companyId };
    if (filters.channel) where.channel = filters.channel;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.status) where.status = filters.status;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async stats(companyId: string) {
    const [total, sent, failed, skipped] = await Promise.all([
      this.prisma.notification.count({ where: { companyId } }),
      this.prisma.notification.count({ where: { companyId, status: 'SENT' } }),
      this.prisma.notification.count({ where: { companyId, status: 'FAILED' } }),
      this.prisma.notification.count({ where: { companyId, status: 'SKIPPED' } }),
    ]);
    return { total, sent, failed, skipped };
  }
}

function monthName(m: number) { return ['', 'January','February','March','April','May','June','July','August','September','October','November','December'][m]; }
