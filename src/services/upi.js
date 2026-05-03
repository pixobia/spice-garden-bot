import QRCode from 'qrcode';
import { config } from '../config.js';

/**
 * Build a UPI deep link. Amount is in rupees (not paise).
 * Format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=Order-<id>
 */
export function buildUri({ orderId, amountPaise }) {
  const amountRupees = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: config.MERCHANT_VPA,
    pn: config.MERCHANT_NAME,
    am: amountRupees,
    cu: 'INR',
    tn: `Order-${orderId}`,
  });
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
