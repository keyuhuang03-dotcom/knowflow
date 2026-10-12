-- Additive migration. Existing photos and relationships remain unchanged.
ALTER TABLE "MistakeItem" ADD COLUMN "imageUrls" TEXT;
