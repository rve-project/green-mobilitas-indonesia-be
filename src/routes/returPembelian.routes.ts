import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { returPembelianController } from "../controllers/returPembelian.controller";

export const returPembelianRouter = Router();

returPembelianRouter.use(requireAuth, requireModule("pembelian"));

returPembelianRouter.get("/", returPembelianController.list);
returPembelianRouter.get("/:id", returPembelianController.get);
returPembelianRouter.post("/", returPembelianController.create);
returPembelianRouter.delete("/:id", returPembelianController.remove);
