-- CreateTable
CREATE TABLE "MistakeJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mistakeId" TEXT NOT NULL,
    "inputVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "owner" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MistakeJob_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "MistakeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MistakeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillRecordId" TEXT,
    "subjectId" TEXT,
    "knowledgeNodeId" TEXT,
    "source" TEXT,
    "userWork" TEXT,
    "userWorkImageUrl" TEXT,
    "userNote" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "answer" TEXT,
    "errorType" TEXT,
    "errorReason" TEXT,
    "aiAnalysis" TEXT,
    "relatedKnowledge" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "processingStatus" TEXT NOT NULL DEFAULT 'complete',
    "processingError" TEXT,
    "inputVersion" INTEGER NOT NULL DEFAULT 0,
    "linksConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MistakeItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MistakeItem_knowledgeNodeId_fkey" FOREIGN KEY ("knowledgeNodeId") REFERENCES "KnowledgeNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MistakeItem" ("aiAnalysis", "answer", "content", "createdAt", "errorReason", "errorType", "id", "imageUrl", "knowledgeNodeId", "relatedKnowledge", "reviewStatus", "reviewedAt", "skillRecordId", "source", "subjectId", "title", "userNote", "userWork", "userWorkImageUrl") SELECT "aiAnalysis", "answer", "content", "createdAt", "errorReason", "errorType", "id", "imageUrl", "knowledgeNodeId", "relatedKnowledge", "reviewStatus", "reviewedAt", "skillRecordId", "source", "subjectId", "title", "userNote", "userWork", "userWorkImageUrl" FROM "MistakeItem";
DROP TABLE "MistakeItem";
ALTER TABLE "new_MistakeItem" RENAME TO "MistakeItem";
CREATE UNIQUE INDEX "MistakeItem_skillRecordId_key" ON "MistakeItem"("skillRecordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MistakeJob_mistakeId_key" ON "MistakeJob"("mistakeId");

-- CreateIndex
CREATE INDEX "MistakeJob_status_availableAt_idx" ON "MistakeJob"("status", "availableAt");

