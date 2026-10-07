ALTER TABLE "MistakeItem" ADD COLUMN "skillRecordId" TEXT;
CREATE UNIQUE INDEX "MistakeItem_skillRecordId_key" ON "MistakeItem"("skillRecordId");
