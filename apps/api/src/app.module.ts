import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { BranchesModule } from './modules/branches/branches.module';
import { SalaryModule } from './modules/salary/salary.module';
import { PayrunModule } from './modules/payrun/payrun.module';
import { PayslipsModule } from './modules/payslips/payslips.module';
import { LeaveModule } from './modules/leave/leave.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { TDSModule } from './modules/tds/tds.module';
import { BankModule } from './modules/bank/bank.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ESSModule } from './modules/ess/ess.module';
import { ContractorModule } from './modules/contractor/contractor.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LoansModule } from './modules/loans/loans.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    EmployeesModule,
    DepartmentsModule,
    BranchesModule,
    SalaryModule,
    PayrunModule,
    PayslipsModule,
    LeaveModule,
    AttendanceModule,
    ComplianceModule,
    TDSModule,
    BankModule,
    ReportsModule,
    ESSModule,
    ContractorModule,
    IntegrationsModule,
    AiModule,
    NotificationsModule,
  ],
})
export class AppModule {}
