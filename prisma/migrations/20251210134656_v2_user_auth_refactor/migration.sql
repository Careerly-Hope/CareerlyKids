/*
  Warnings:

  - The values [DELETED] on the enum `AccountStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PARENT,TEACHER,SCHOOL_ADMIN] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `saved_careers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_preferences` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccountStatus_new" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING');
ALTER TABLE "public"."users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "AccountStatus_new" USING ("status"::text::"AccountStatus_new");
ALTER TYPE "AccountStatus" RENAME TO "AccountStatus_old";
ALTER TYPE "AccountStatus_new" RENAME TO "AccountStatus";
DROP TYPE "public"."AccountStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STUDENT', 'GUEST');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "saved_careers" DROP CONSTRAINT "saved_careers_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_notifications" DROP CONSTRAINT "user_notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_userId_fkey";

-- DropTable
DROP TABLE "saved_careers";

-- DropTable
DROP TABLE "user_notifications";

-- DropTable
DROP TABLE "user_preferences";
