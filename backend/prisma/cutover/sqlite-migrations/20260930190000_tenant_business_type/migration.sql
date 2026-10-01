-- Тип заведения: кафе (по умолчанию — поведение существующих точек не меняется)
-- или магазин (сканер штрихкодов, весовой товар, чек без столов).
ALTER TABLE "tenants" ADD COLUMN "business_type" TEXT NOT NULL DEFAULT 'cafe';
