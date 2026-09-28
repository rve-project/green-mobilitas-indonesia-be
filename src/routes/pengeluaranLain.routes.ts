import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pengeluaranLainController } from "../controllers/pengeluaranLain.controller";

export const pengeluaranLainRouter = Router();

pengeluaranLainRouter.use(requireAuth, requireModule("pembelian"));

pengeluaranLainRouter.get("/", pengeluaranLainController.list);
pengeluaranLainRouter.get("/:id", pengeluaranLainController.get);
pengeluaranLainRouter.post("/", pengeluaranLainController.create);
pengeluaranLainRouter.put("/:id", pengeluaranLainController.update);
pengeluaranLainRouter.delete("/:id", pengeluaranLainController.remove);
