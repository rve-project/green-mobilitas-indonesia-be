import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { supplierController } from "../controllers/supplier.controller";

export const supplierRouter = Router();

supplierRouter.use(requireAuth, requireModule("supplier"));

supplierRouter.get("/", supplierController.list);
supplierRouter.get("/stats", supplierController.stats);
supplierRouter.get("/:id", supplierController.get);
supplierRouter.post("/", supplierController.create);
supplierRouter.put("/:id", supplierController.update);
supplierRouter.delete("/:id", supplierController.remove);
