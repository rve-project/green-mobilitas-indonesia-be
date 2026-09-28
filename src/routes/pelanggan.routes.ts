import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pelangganController } from "../controllers/pelanggan.controller";

export const pelangganRouter = Router();

pelangganRouter.use(requireAuth, requireModule("pelanggan"));

pelangganRouter.get("/", pelangganController.list);
pelangganRouter.get("/stats", pelangganController.stats);
pelangganRouter.get("/:id", pelangganController.get);
pelangganRouter.post("/", pelangganController.create);
pelangganRouter.put("/:id", pelangganController.update);
pelangganRouter.delete("/:id", pelangganController.remove);
