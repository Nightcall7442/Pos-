import prisma from "../../config/database.js";
import { NotFoundError } from "../../utils/errors.js";

// Receipt HTML is assembled from user-entered strings (shop name, customer
// name, product names) — escape them so a stray "<" can't break or script the
// receipt window.
const escapeHtml = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface ReceiptData {
  order: any;
  tenant: any;
  payments: any[];
  items: any[];
}

export class ReceiptService {
  async getReceiptData(tenantId: string, orderId: string): Promise<ReceiptData> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            modifiers: { include: { modifierItem: true } },
          },
        },
        table: { select: { id: true, number: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        payments: true,
      },
    });

    if (!order) throw new NotFoundError("Заказ не найден");

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    return {
      order,
      tenant,
      payments: order.payments,
      items: order.items,
    };
  }

  async generateReceiptHTML(tenantId: string, orderId: string): Promise<string> {
    const data = await this.getReceiptData(tenantId, orderId);
    return this.buildReceiptHTML(data);
  }

  async markAsPrinted(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundError("Заказ не найден");

    const existingReceipt = await prisma.receipt.findFirst({
      where: { orderId },
    });

    if (existingReceipt) {
      return prisma.receipt.update({
        where: { id: existingReceipt.id },
        data: { printedAt: new Date() },
      });
    }

    return prisma.receipt.create({
      data: {
        tenantId,
        orderId,
        printedAt: new Date(),
        template: "standard",
      },
    });
  }

  private buildReceiptHTML(data: ReceiptData): string {
    const { order, tenant, items } = data;
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru-RU");
    const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const itemsHTML = items.map((item: any) => {
      const modifiersText = item.modifiers?.length
        ? item.modifiers.map((m: any) => `  + ${escapeHtml(m.modifierItem.name)} (${Number(m.price).toFixed(2)})`).join("\n")
        : "";
      const weight = item.weightGrams ? ` (${Number(item.weightGrams)} г)` : "";
      const unit = item.quantity > 1 ? ` × ${Number(item.unitPrice).toFixed(2)}` : "";
      return `
        <tr>
          <td>${item.quantity}x ${escapeHtml(item.product.name)}${weight}${unit}</td>
          <td class="right">${Number(item.totalPrice).toFixed(2)}</td>
        </tr>
        ${modifiersText ? `<tr><td class="modifier">${modifiersText}</td><td></td></tr>` : ""}
      `;
    }).join("");

    const paymentMethod = order.payments?.[0]?.method === "card" ? "Карта" : "Наличные";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Чек №${order.orderNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      margin: 0 auto;
      padding: 10mm;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header h2 {
      margin: 0;
      font-size: 16px;
    }
    .header p {
      margin: 2px 0;
      font-size: 10px;
    }
    .info {
      margin-bottom: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    td {
      padding: 2px 0;
      vertical-align: top;
    }
    .right {
      text-align: right;
    }
    .modifier {
      font-size: 10px;
      color: #333;
    }
    .totals {
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 10px;
    }
    .print-btn {
      display: block;
      width: 100%;
      padding: 12px;
      margin-top: 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${escapeHtml(tenant?.name || "Qwik")}</h2>
    <p>${escapeHtml(tenant?.address || "")}</p>
    <p>${escapeHtml(tenant?.phone || "")}</p>
  </div>

  <div class="info">
    <div class="info-row">
      <span>Чек №:</span>
      <span>${order.orderNumber}</span>
    </div>
    <div class="info-row">
      <span>Дата:</span>
      <span>${dateStr} ${timeStr}</span>
    </div>
    <div class="info-row">
      <span>Тип:</span>
      <span>${order.type === "dine_in" ? "В зале" : order.type === "takeaway" ? "Навынос" : escapeHtml(order.type)}</span>
    </div>
    ${order.table ? `<div class="info-row"><span>Стол:</span><span>${escapeHtml(order.table.number)}</span></div>` : ""}
    ${order.customerName ? `<div class="info-row"><span>Клиент:</span><span>${escapeHtml(order.customerName)}</span></div>` : ""}
    ${order.user ? `<div class="info-row"><span>Официант:</span><span>${escapeHtml(order.user.firstName)}</span></div>` : ""}
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left">Наименование</th>
        <th style="text-align:right">Сумма</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Подытог:</span>
      <span>${Number(order.subtotal).toFixed(2)} ₽</span>
    </div>
    ${Number(order.taxAmount) > 0 ? `
    <div class="total-row">
      <span>Налог:</span>
      <span>${Number(order.taxAmount).toFixed(2)} ₽</span>
    </div>
    ` : ""}
    ${Number(order.discountAmount) > 0 ? `
    <div class="total-row">
      <span>Скидка:</span>
      <span>-${Number(order.discountAmount).toFixed(2)} ₽</span>
    </div>
    ` : ""}
    <div class="total-row" style="font-size: 14px; margin-top: 4px;">
      <span>ИТОГО:</span>
      <span>${Number(order.total).toFixed(2)} ₽</span>
    </div>
  </div>

  <div class="info" style="margin-top: 8px;">
    <div class="info-row">
      <span>Оплата:</span>
      <span>${paymentMethod}</span>
    </div>
    ${order.payments?.[0]?.amount ? `
    <div class="info-row">
      <span>Сумма оплаты:</span>
      <span>${Number(order.payments[0].amount).toFixed(2)} ₽</span>
    </div>
    ` : ""}
  </div>

  <div class="footer">
    <p>Спасибо за покупку!</p>
    <p>${escapeHtml((() => { try { return tenant?.settings ? JSON.parse(tenant.settings).receipt_footer || "" : ""; } catch { return ""; } })())}</p>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨️ Печать чека</button>
</body>
</html>`;
  }
}

export const receiptService = new ReceiptService();
