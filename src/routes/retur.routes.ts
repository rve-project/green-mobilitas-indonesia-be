import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { returController } from "../controllers/retur.controller";

export const returRouter = Router();

returRouter.use(requireAuth, requireModule("penjualan"));

returRouter.get("/", returController.list);
returRouter.get("/:id", returController.get);
returRouter.post("/", returController.create);
returRouter.put("/:id", returController.update);
returRouter.delete("/:id", returController.remove);
