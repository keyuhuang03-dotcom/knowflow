ALTER TABLE "Subject" ADD COLUMN "partTextbooks" TEXT;
ALTER TABLE "KnowledgeNode" ADD COLUMN "subjectPart" TEXT;
UPDATE "Subject" SET "partTextbooks" = json_object('calculus', "textbookTitle") WHERE "id"='math' AND "textbookTitle" LIKE '%高等数学%';
UPDATE "KnowledgeNode" SET "subjectPart"='calculus' WHERE "subjectId"='math' AND "catalogImported"=1 AND EXISTS (SELECT 1 FROM "Subject" WHERE "id"='math' AND "textbookTitle" LIKE '%高等数学%');
