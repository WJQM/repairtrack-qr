/*
  Warnings:

  - You are about to drop the column `description` on the `Software` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Software" DROP COLUMN "description",
ADD COLUMN     "minRequirements" TEXT,
ADD COLUMN     "recRequirements" TEXT,
ADD COLUMN     "size" TEXT;
