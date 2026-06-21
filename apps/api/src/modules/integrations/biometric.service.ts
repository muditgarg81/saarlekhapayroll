import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AttendanceService } from '../attendance/attendance.service';

export interface Punch { deviceUserId: string; timestamp: Date; raw?: string; }

@Injectable()
export class BiometricService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private attendance: AttendanceService,
  ) {}

  // ── Parse iClock / ATTLOG payloads ────────────────────────────────────────
  /**
   * Accepts ZKTeco/eSSL ATTLOG (tab-separated) or simple CSV.
   * Each line: <userId><sep><YYYY-MM-DD HH:mm:ss>[<sep>status<sep>verify...]
   * Separator auto-detected: tab, comma, or whitespace.
   */
  parsePunches(raw: string): { punches: Punch[]; badLines: number } {
    const punches: Punch[] = [];
    let badLines = 0;
    const lines = (raw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // skip header rows
      if (/^(userid|user_id|pin|emp|employee)\b/i.test(line)) continue;
      const parts = line.includes('\t') ? line.split('\t')
        : line.includes(',') ? line.split(',')
        : line.split(/\s{2,}|\s(?=\d{4}-)/);
      if (parts.length < 2) { badLines++; continue; }

      const deviceUserId = parts[0].trim();
      // datetime may be parts[1] or parts[1]+parts[2] when split on single spaces
      let dtStr = parts[1].trim();
      if (!/\d{2}:\d{2}/.test(dtStr) && parts[2]) dtStr = `${parts[1].trim()} ${parts[2].trim()}`;
      const ts = this._parseDateTime(dtStr);
      if (!deviceUserId || !ts) { badLines++; continue; }
      punches.push({ deviceUserId, timestamp: ts, raw: line });
    }
    return { punches, badLines };
  }

  private _parseDateTime(s: string): Date | null {
    // Supports "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", "DD-MM-YYYY HH:mm"
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── Resolve device user id → employee ─────────────────────────────────────
  private async _buildEmployeeMap(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, biometricCode: true, employeeCode: true },
    });
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.biometricCode) map.set(e.biometricCode.trim(), e.id);
      // also allow matching by employee code as a fallback
      if (!map.has(e.employeeCode)) map.set(e.employeeCode.trim(), e.id);
    }
    return map;
  }

  // ── Core: punches → attendance ────────────────────────────────────────────
  /**
   * Groups punches per employee+day; earliest = check-in, latest = check-out.
   * Reuses AttendanceService so shift OT/late are computed.
   */
  async processPunches(companyId: string, punches: Punch[]) {
    const empMap = await this._buildEmployeeMap(companyId);

    // group: empId -> dateKey -> { in, out }
    const grouped: Record<string, Record<string, { min: Date; max: Date; count: number }>> = {};
    const unmatched = new Set<string>();
    let matchedPunches = 0;

    for (const p of punches) {
      const empId = empMap.get(p.deviceUserId.trim());
      if (!empId) { unmatched.add(p.deviceUserId); continue; }
      matchedPunches++;
      const dateKey = `${p.timestamp.getFullYear()}-${String(p.timestamp.getMonth() + 1).padStart(2, '0')}-${String(p.timestamp.getDate()).padStart(2, '0')}`;
      grouped[empId] ??= {};
      const slot = grouped[empId][dateKey];
      if (!slot) grouped[empId][dateKey] = { min: p.timestamp, max: p.timestamp, count: 1 };
      else {
        if (p.timestamp < slot.min) slot.min = p.timestamp;
        if (p.timestamp > slot.max) slot.max = p.timestamp;
        slot.count++;
      }
    }

    // write attendance
    let daysWritten = 0;
    const employeesAffected = new Set<string>();
    for (const [empId, days] of Object.entries(grouped)) {
      for (const [dateKey, slot] of Object.entries(days)) {
        const single = slot.min.getTime() === slot.max.getTime();
        await this.attendance.markAttendance(empId, {
          date: dateKey,
          status: 'PRESENT',
          checkIn: slot.min.toISOString(),
          checkOut: single ? undefined : slot.max.toISOString(),
          source: 'BIOMETRIC',
          notes: `${slot.count} punch(es) from biometric device`,
        });
        daysWritten++;
        employeesAffected.add(empId);
      }
    }

    return {
      totalPunches: punches.length,
      matchedPunches,
      daysWritten,
      employeesAffected: employeesAffected.size,
      unmatchedUserIds: Array.from(unmatched),
    };
  }

  // ── Find the integration that owns a device serial ────────────────────────
  async findBySerial(serial: string) {
    if (!serial) return null;
    return this.prisma.integration.findFirst({
      where: { category: 'BIOMETRIC', config: { path: ['serialNumber'], equals: serial } },
    });
  }

  // ── Ingest from a device push (iClock) ────────────────────────────────────
  async ingestFromDevice(serial: string, rawBody: string) {
    const integration = await this.findBySerial(serial);
    if (!integration) throw new NotFoundException(`No biometric device registered with serial ${serial}`);

    const { punches, badLines } = this.parsePunches(rawBody);
    const log = await this.prisma.integrationSyncLog.create({
      data: { integrationId: integration.id, companyId: integration.companyId, direction: 'INBOUND', operation: 'ATTENDANCE_PULL', status: 'RUNNING' },
    });

    try {
      const result = punches.length ? await this.processPunches(integration.companyId, punches) : { totalPunches: 0, matchedPunches: 0, daysWritten: 0, employeesAffected: 0, unmatchedUserIds: [] };
      const failed = (result.totalPunches - result.matchedPunches) + badLines;
      const status = result.matchedPunches === 0 && result.totalPunches > 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'SUCCESS';
      const message = `${result.daysWritten} day(s) for ${result.employeesAffected} employee(s) from ${result.matchedPunches}/${result.totalPunches} punches${result.unmatchedUserIds.length ? `; unmatched IDs: ${result.unmatchedUserIds.slice(0, 10).join(', ')}` : ''}`;

      await this.prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: { status, recordsTotal: result.totalPunches, recordsOk: result.matchedPunches, recordsFailed: failed, message, payload: result as any, finishedAt: new Date() },
      });
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncError: status === 'SUCCESS' ? null : message, status: 'CONNECTED' },
      });
      return { ...result, status, logId: log.id };
    } catch (err: any) {
      await this.prisma.integrationSyncLog.update({ where: { id: log.id }, data: { status: 'FAILED', message: err.message, finishedAt: new Date() } });
      throw err;
    }
  }

  // ── Manual upload (paste/upload punch text from device admin) ──────────────
  async manualUpload(companyId: string, actorId: string, provider: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('No punch data provided');
    const integration = await this.prisma.integration.findUnique({ where: { companyId_provider: { companyId, provider } } });
    if (!integration || integration.status === 'DISCONNECTED') throw new BadRequestException('Integration is not connected');

    const { punches, badLines } = this.parsePunches(content);
    if (!punches.length) throw new BadRequestException(`No valid punch rows found (${badLines} unparseable lines)`);

    const result = await this.processPunches(companyId, punches);
    const failed = (result.totalPunches - result.matchedPunches) + badLines;
    const status = result.matchedPunches === 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'SUCCESS';
    const message = `Manual upload: ${result.daysWritten} day(s) for ${result.employeesAffected} employee(s) from ${result.matchedPunches}/${result.totalPunches} punches`;

    await this.prisma.integrationSyncLog.create({
      data: { integrationId: integration.id, companyId, direction: 'INBOUND', operation: 'ATTENDANCE_PULL', status, recordsTotal: result.totalPunches, recordsOk: result.matchedPunches, recordsFailed: failed, message, payload: result as any, finishedAt: new Date() },
    });
    await this.prisma.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastSyncStatus: status } });
    await this.audit.log(actorId, companyId, 'CREATE', 'Attendance', null, `Biometric manual punch upload (${provider}): ${message}`);
    return { ...result, badLines, status };
  }

  // ── Build the device push endpoint for the connect UI ─────────────────────
  async getDeviceEndpoint(companyId: string, provider: string, baseUrl: string) {
    const integration = await this.prisma.integration.findUnique({ where: { companyId_provider: { companyId, provider } } });
    const serial = (integration?.config as any)?.serialNumber || '<DEVICE_SERIAL>';
    return {
      provider,
      serialNumber: serial,
      pushUrl: `${baseUrl}/api/biometric/iclock/cdata?SN=${serial}`,
      protocol: 'ZKTeco/eSSL iClock (ADMS) push',
      instructions: [
        'On the device (or its push/ADMS settings), set the server domain/path to the URL above.',
        'Ensure the device Serial (SN) matches the one saved in this integration.',
        'Map each device enrollment ID to an employee via the employee\'s Biometric Code (falls back to Employee Code).',
      ],
    };
  }
}
