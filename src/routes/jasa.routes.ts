import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { jasaController } from "../controllers/jasa.controller";
import { uploadXlsx } from "../middlewares/upload";

export const jasaRouter = Router();

jasaRouter.use(requireAuth, requireModule("barang-jasa"));

jasaRouter.get("/template", jasaController.template);
jasaRouter.get("/export", jasaController.exportXlsx);
jasaRouter.post("/import", uploadXlsx, jasaController.importXlsx);
jasaRouter.get("/", jasaController.list);
jasaRouter.get("/:id", jasaController.get);
jasaRouter.post("/", jasaController.create);
jasaRouter.put("/:id", jasaController.update);
jasaRouter.delete("/:id", jasaController.remove);
