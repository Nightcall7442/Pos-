-- Кухонный статус заказа — отдельно от оплаты (см. schema.prisma, Order.kitchenStatus).
ALTER TABLE "orders" ADD COLUMN "kitchen_status" TEXT;
ALTER TABLE "orders" ADD COLUMN "kitchen_status_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_tenant_id_kitchen_status_idx" ON "orders"("tenant_id", "kitchen_status");

-- Заказы кафе, которые сейчас в работе, остаются на экране кухни на том же шаге.
UPDATE "orders" AS o
SET "kitchen_status" = CASE o."status"
      WHEN 'pending' THEN 'new'
      WHEN 'confirmed' THEN 'new'
      WHEN 'preparing' THEN 'cooking'
      WHEN 'ready' THEN 'ready'
    END,
    "kitchen_status_at" = o."updated_at"
FROM "tenants" AS t
WHERE t."id" = o."tenant_id"
  AND t."business_type" = 'cafe'
  AND o."status" IN ('pending', 'confirmed', 'preparing', 'ready');
