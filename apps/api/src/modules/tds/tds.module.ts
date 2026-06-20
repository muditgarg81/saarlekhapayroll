import { Module } from '@nestjs/common';
import { TDSController } from './tds.controller';
import { TDSService } from './tds.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:     [AuditModule],
  controllers: [TDSController],
  providers:   [TDSService],
  exports:     [TDSService],
})
export class TDSModule {}
