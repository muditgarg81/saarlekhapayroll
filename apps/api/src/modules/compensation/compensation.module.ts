import { Module } from '@nestjs/common';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CompensationController],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
