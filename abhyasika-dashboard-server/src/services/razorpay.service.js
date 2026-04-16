import crypto from "crypto";
import Razorpay from "razorpay";
import { AppError } from "../utils/AppError.js";
import { config } from "../config/env.js";

let razorpayInstance = null;

function getInstance() {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new AppError(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      500
    );
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret,
    });
  }
  return razorpayInstance;
}

export function getPublicKeyId() {
  return config.razorpayKeyId ?? null;
}

export async function createOrder({
  amountPaise,
  currency = "INR",
  receipt,
  notes = {},
}) {
  const instance = getInstance();
  try {
    const order = await instance.orders.create({
      amount: amountPaise,
      currency,
      receipt,
      notes,
    });
    return order;
  } catch (err) {
    const message =
      err?.error?.description ?? err?.message ?? "Failed to create Razorpay order";
    throw new AppError(message, 502);
  }
}

export function verifySignature({ orderId, paymentId, signature }) {
  if (!config.razorpayKeySecret) {
    throw new AppError("Razorpay secret is not configured", 500);
  }
  if (!orderId || !paymentId || !signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", config.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8")
  );
}
