import api from "../services/api";

/**
 * Prints the server-rendered receipt through a hidden iframe. A popup window
 * would be blocked in kiosk browsers (and anywhere popups are off), which once
 * left the cashier with no way to print at all.
 */
export async function printReceipt(orderId: string): Promise<void> {
  const response = await api.get(`/receipts/${orderId}`, { responseType: "text" });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("no document");
  }
  doc.open();
  doc.write(response.data as string);
  doc.close();

  // Give the print dialog a moment to take its snapshot before the frame goes away.
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup, { once: true });
  win.focus();
  win.print();
  // Safari/Chrome do not always emit afterprint; remove it anyway.
  setTimeout(cleanup, 5000);

  await api.post(`/receipts/${orderId}/print`);
}
