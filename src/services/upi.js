import QRCode from 'qrcode';
import { config } from '../config.js';

/**
 * Build a UPI deep link. Amount is in whole rupees.
 * Format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...[&mc=...]
 *
 * `tr` is a unique transaction reference per order (UPI apps treat it as the
 * merchant order id). `mc` (merchant category code) is added only when
 * configured — together they mark this as a merchant collection (P2M) rather
 * than a person-to-person transfer, which reduces UPI risk-policy blocks.
 */
export function buildUri({ orderId, amount }) {
  const params = new URLSearchParams({
    pa: config.MERCHANT_VPA,
    pn: config.MERCHANT_NAME,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: buildRef(orderId),
    tr: buildRef(orderId),
  });
  if (config.MERCHANT_MCC) params.set('mc', config.MERCHANT_MCC);
  return `upi://pay?${params.toString()}`;
}

export function buildRef(orderId) {
  return `Order-${orderId}`;
}

export async function generateQrPng(uri) {
  return QRCode.toBuffer(uri, {
    type: 'png',
    errorCorrectionLevel: 'M',
    width: 400,
    margin: 2,
  });
}
