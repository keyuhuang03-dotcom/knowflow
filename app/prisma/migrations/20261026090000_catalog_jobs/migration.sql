CREATE TABLE "CatalogJob" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "subjectId" TEXT NOT NULL,
 "part" TEXT NOT NULL DEFAULT '',
 "images" TEXT NOT NULL,
 "entries" TEXT NOT NULL DEFAULT '[]',
 "warnings" TEXT NOT NULL DEFAULT '[]',
 "completedPages" INTEGER NOT NULL DEFAULT 0,
 "status" TEXT NOT NULL DEFAULT 'queued',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseUntil" DATETIME,
 "owner" TEXT,
 "lastError" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "CatalogJob_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CatalogJob_status_availableAt_idx" ON "CatalogJob"("status", "availableAt");
CREATE INDEX "CatalogJob_subjectId_part_createdAt_idx" ON "CatalogJob"("subjectId", "part", "createdAt");
