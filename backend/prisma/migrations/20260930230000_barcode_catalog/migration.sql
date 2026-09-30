-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "catalog_sharing" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "catalog_products" (
    "barcode" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "quantity" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'snapshot',
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "catalog_meta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
