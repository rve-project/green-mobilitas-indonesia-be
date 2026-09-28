import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pembayaranController } from "../controllers/pembayaran.controller";

export const pembayaranRouter = Router();

pembayaranRouter.use(requireAuth, requireModule("penjualan"));

pembayaranRouter.get("/", pembayaranController.list);
pembayaranRouter.post("/", pembayaranController.create);
pembayaranRouter.put("/:id", pembayaranController.update);
pembayaranRouter.delete("/:id", pembayaranController.remove);
