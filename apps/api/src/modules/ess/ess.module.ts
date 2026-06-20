import { Module } from '@nestjs/common';
import { ESSController } from './ess.controller';
import { ESSService } from './ess.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ESSController],
  providers: [ESSService],
  exports: [ESSService],
})
export class ESSModule {}
