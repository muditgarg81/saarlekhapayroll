import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { AuditModule } from '../audit/audit.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AuditModule, AttendanceModule],
  controllers: [IntegrationsController, BiometricController],
  providers: [IntegrationsService, BiometricService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
