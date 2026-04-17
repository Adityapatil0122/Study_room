import { Router } from "express";
import {
  getMyProfile,
  putMyProfile,
  getPlans,
  getMySubscription,
  getMyPayments,
  postCreateOrder,
  postVerifyPayment,
  postPreviewQrPayment,
  postRequestQrPayment,
  getAvailableSeats,
  postSelectSeat,
  postCreateScheduledOrder,
  postVerifyScheduledPayment,
} from "../controllers/studentApp.controller.js";

const router = Router();

router.get("/profile", getMyProfile);
router.put("/profile", putMyProfile);
router.get("/plans", getPlans);
router.get("/subscription", getMySubscription);
router.get("/payments", getMyPayments);
router.post("/payments/create-order", postCreateOrder);
router.post("/payments/verify", postVerifyPayment);
router.post("/payments/qr-preview", postPreviewQrPayment);
router.post("/payments/request-qr", postRequestQrPayment);
router.post("/payments/scheduled-order", postCreateScheduledOrder);
router.post("/payments/scheduled-verify", postVerifyScheduledPayment);
router.get("/seats", getAvailableSeats);
router.post("/seats/select", postSelectSeat);

export default router;
