-- CreateEnum
CREATE TYPE "OrganizationAction" AS ENUM ('INVITATION_CANCELLED', 'MEMBER_REMOVED', 'MEMBER_LEFT', 'PARTICIPATION_REMOVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MembershipStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "MembershipStatus" ADD VALUE 'REMOVED';
ALTER TYPE "MembershipStatus" ADD VALUE 'LEFT';

-- AlterTable
ALTER TABLE "OrganizationMember" ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "OrganizationAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" "OrganizationAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "eventId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
