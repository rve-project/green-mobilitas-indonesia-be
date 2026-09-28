import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { laporanController } from "../controllers/laporan.controller";

export const laporanRouter = Router();

laporanRouter.use(requireAuth, requireModule("laporan"));

laporanRouter.post("/export-xlsx", laporanController.exportXlsx);
