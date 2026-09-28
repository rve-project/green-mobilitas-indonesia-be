import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { periodeGajiController } from "../controllers/periodeGaji.controller";

export const periodeGajiRouter = Router();

periodeGajiRouter.use(requireAuth, requireModule("manajemen-karyawan"));

periodeGajiRouter.get("/", periodeGajiController.list);
periodeGajiRouter.get("/:id", periodeGajiController.get);
periodeGajiRouter.post("/", periodeGajiController.create);
periodeGajiRouter.delete("/:id", periodeGajiController.remove);
