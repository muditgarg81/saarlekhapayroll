import { Controller, Get, Post, Query, Req, Header } from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
import { BiometricService } from './biometric.service';

/**
 * Public ZKTeco/eSSL iClock (ADMS / Push SDK) endpoint.
 * Devices are configured with this server's domain; they push punch logs here.
 * No JWT — devices authenticate by their registered serial number (SN).
 */
@ApiTags('Biometric (device push)')
@ApiExcludeController()
@Controller('biometric/iclock')
export class BiometricController {
  constructor(private biometric: BiometricService) {}

  // Device handshake — fetches config/options.
  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  async handshake(@Query('SN') sn: string) {
    const integration = await this.biometric.findBySerial(sn);
    if (!integration) return 'OK';
    // Minimal iClock options block the device expects.
    return [
      `GET OPTION FROM: ${sn}`,
      'Stamp=9999',
      'OpStamp=9999',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=1111000000',
      'Realtime=1',
      'Encrypt=0',
    ].join('\n');
  }

  // Device uploads punch logs (ATTLOG) and other tables.
  @Post('cdata')
  @Header('Content-Type', 'text/plain')
  async cdata(@Query('SN') sn: string, @Query('table') table: string, @Req() req: any) {
    const body: string = typeof req.body === 'string' ? req.body : '';
    // Only ATTLOG carries attendance punches; ACK other tables (OPERLOG/options) without processing.
    if (table && table.toUpperCase() !== 'ATTLOG') {
      const rows = body ? body.split(/\r?\n/).filter(Boolean).length : 0;
      return `OK: ${rows}`;
    }
    try {
      const result = await this.biometric.ingestFromDevice(sn, body);
      return `OK: ${result.matchedPunches}`;
    } catch {
      // Devices retry on non-OK; respond OK to avoid storms, the sync log records failures.
      return 'OK: 0';
    }
  }

  // Device polls for server commands; we have none.
  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  getrequest() {
    return 'OK';
  }

  // Device posts command execution results.
  @Post('devicecmd')
  @Header('Content-Type', 'text/plain')
  devicecmd() {
    return 'OK';
  }
}
