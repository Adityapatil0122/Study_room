import { Router } from "express";
import {
  getMyProfile,
  putMyProfile,
  getPlans,
  getMySubscription,
  getMyPayments,
  postCreateOrder,
  postVerifyPayment,
  postRequestQrPayment,
  getAvailableSeats,
  postSelectSeat,
} from "../controllers/studentApp.controller.js";

const router = Router();

router.get("/profile", getMyProfile);
router.put("/profile", putMyProfile);
router.get("/plans", getPlans);
router.get("/subscription", getMySubscription);
router.get("/payments", getMyPayments);
router.post("/payments/create-order", postCreateOrder);
router.post("/payments/verify", postVerifyPayment);
router.post("/payments/request-qr", postRequestQrPayment);
router.get("/seats", getAvailableSeats);
router.post("/seats/select", postSelectSeat);

export default router;
