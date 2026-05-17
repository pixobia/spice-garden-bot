import * as orderService from "../services/order.js";
import * as upiService from "../services/upi.js";

/**
 * Serve the UPI QR for an order as image/png.
 *
 * Why this exists:
 * Telegram's `sendPhoto` accepts either a binary upload (multipart/form-data)
 * or a URL it can fetch itself. Multipart uploads from Render's free tier are
 * unreliable — the outbound connection to api.telegram.org frequently drops
 * mid-stream with "socket hang up" (ECONNRESET), while short JSON POSTs from
 * the same pod succeed. By exposing the QR at a public URL, we let Telegram's
 * own CDN pull the image and our process only has to send a ~200-byte JSON
 * payload to api.telegram.org.
 *
 * The URL is safe to expose: the QR encodes a UPI deep link that already
 * contains the merchant VPA, name, amount, and a per-order reference. Any
 * scan would just credit that order. We still gate on order status so QRs
 * disappear for paid/rejected orders.
 */
export async function renderQrPng(req, res, next) {
  try {
    // Route is mounted as /qr/:orderId.png — strip the extension if present.
    const raw = String(req.params.orderId || "").replace(/\.png$/i, "");
    const id = Number(raw);
    if (!Number.isFinite(id)) return res.status(400).send("Bad order id");

    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).send("Order not found");

    if (order.status !== "AWAITING_PAYMENT") {
      // Don't 404 here — a 410 makes the state explicit and helps debugging
      // if Telegram ever caches and re-requests the URL after payment.
      return res.status(410).send(`Order ${id} is no longer awaiting payment`);
    }

    const uri = upiService.buildUri({
      orderId: order.id,
      amount: order.total,
    });
    const png = await upiService.generateQrPng(uri);

    res.set({
      "Content-Type": "image/png",
      // No caching: amount/state could change before Telegram fetches.
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": png.length,
    });
    return res.status(200).end(png);
  } catch (err) {
    next(err);
  }
}
