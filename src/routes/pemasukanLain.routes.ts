import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pemasukanLainController } from "../controllers/pemasukanLain.controller";

export const pemasukanLainRouter = Router();

pemasukanLainRouter.use(requireAuth, requireModule("penjualan"));

pemasukanLainRouter.get("/", pemasukanLainController.list);
pemasukanLainRouter.get("/:id", pemasukanLainController.get);
pemasukanLainRouter.post("/", pemasukanLainController.create);
pemasukanLainRouter.put("/:id", pemasukanLainController.update);
pemasukanLainRouter.delete("/:id", pemasukanLainController.remove);
