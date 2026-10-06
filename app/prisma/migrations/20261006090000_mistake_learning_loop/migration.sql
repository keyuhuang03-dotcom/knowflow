-- Additive migration: retain all existing records and the legacy primary node.
ALTER TABLE "Subject" ADD COLUMN "textbookTitle" TEXT;
ALTER TABLE "MistakeItem" ADD COLUMN "source" TEXT;
ALTER TABLE "MistakeItem" ADD COLUMN "userWork" TEXT;
ALTER TABLE "MistakeItem" ADD COLUMN "userWorkImageUrl" TEXT;
ALTER TABLE "MistakeItem" ADD COLUMN "userNote" TEXT;
CREATE TABLE "_MistakeNodes" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_MistakeNodes_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "_MistakeNodes_B_fkey" FOREIGN KEY ("B") REFERENCES "MistakeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_MistakeNodes_AB_unique" ON "_MistakeNodes"("A", "B");
CREATE INDEX "_MistakeNodes_B_index" ON "_MistakeNodes"("B");
INSERT OR IGNORE INTO "_MistakeNodes" ("A", "B")
SELECT "knowledgeNodeId", "id" FROM "MistakeItem" WHERE "knowledgeNodeId" IS NOT NULL;
