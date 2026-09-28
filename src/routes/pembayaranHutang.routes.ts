import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pembayaranHutangController } from "../controllers/pembayaranHutang.controller";

export const pembayaranHutangRouter = Router();

pembayaranHutangRouter.use(requireAuth, requireModule("pembelian"));

pembayaranHutangRouter.get("/", pembayaranHutangController.list);
pembayaranHutangRouter.post("/", pembayaranHutangController.create);
pembayaranHutangRouter.delete("/:id", pembayaranHutangController.remove);
