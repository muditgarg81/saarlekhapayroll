import { Module } from '@nestjs/common';
import { PayrunController } from './payrun.controller';
import { PayrunService } from './payrun.service';
import { PayrollEngine } from './payroll-engine.service';
import { ComplianceModule } from '../compliance/compliance.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ComplianceModule, AuditModule],
  controllers: [PayrunController],
  providers: [PayrunService, PayrollEngine],
  exports: [PayrunService, PayrollEngine],
})
export class PayrunModule {}
