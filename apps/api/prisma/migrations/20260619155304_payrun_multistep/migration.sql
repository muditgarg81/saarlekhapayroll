-- AlterTable
ALTER TABLE "Payrun" ADD COLUMN     "employeeIds" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "gratuityAmount" DOUBLE PRECISION,
ADD COLUMN     "leaveEncashment" DOUBLE PRECISION,
ADD COLUMN     "overrideComponents" JSONB,
ADD COLUMN     "overrideNote" TEXT;
