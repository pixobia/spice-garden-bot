import * as orderService from "../services/order.js";
import * as upiService from "../services/upi.js";

/**
 * Redirects /pay/:orderId → upi://pay?... so the inline Telegram button
 * (which requires https) can hand off to the user's UPI app.
 */
export async function redirectToUpi(req, res, next) {
  try {
    const id = Number(req.params.orderId);
    if (!Number.isFinite(id)) return res.status(400).send("Bad order id");

    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).send("Order not found");

    if (order.status !== "AWAITING_PAYMENT") {
      return res
        .status(409)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:-apple-system,sans-serif;padding:24px;line-height:1.5;">
          <h2 style="font-weight:500;margin:0 0 8px;">This order is no longer awaiting payment.</h2>
          <p style="color:#6b7280;margin:0;">Status: <code>${order.status}</code></p>
        </body></html>`
        );
    }

    const uri = upiService.buildUri({
      orderId: order.id,
      amount: order.total,
    });
    res.redirect(302, uri);
  } catch (err) {
    next(err);
  }
}
