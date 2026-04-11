import { Router } from "express";
import {
  getPayments,
  postImportPayments,
  postPayment,
} from "../controllers/payments.controller.js";

const router = Router();

router.get("/", getPayments);
router.post("/import", postImportPayments);
router.post("/", postPayment);

export default router;
