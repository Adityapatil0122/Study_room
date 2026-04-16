import { Router } from "express";
import {
  getPayments,
  postImportPayments,
  postPayment,
  listPending,
  approvePending,
  rejectPending,
} from "../controllers/payments.controller.js";

const router = Router();

router.get("/", getPayments);
router.post("/import", postImportPayments);
router.post("/", postPayment);
router.get("/pending", listPending);
router.post("/pending/:id/approve", approvePending);
router.post("/pending/:id/reject", rejectPending);

export default router;
