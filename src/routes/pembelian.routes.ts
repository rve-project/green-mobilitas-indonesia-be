import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pembelianController } from "../controllers/pembelian.controller";

export const pembelianRouter = Router();

pembelianRouter.use(requireAuth, requireModule("pembelian"));

pembelianRouter.get("/", pembelianController.list);
pembelianRouter.get("/:id", pembelianController.get);
pembelianRouter.post("/", pembelianController.create);
pembelianRouter.put("/:id", pembelianController.update);
pembelianRouter.delete("/:id", pembelianController.remove);
