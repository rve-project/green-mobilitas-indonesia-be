import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { posisiController } from "../controllers/posisi.controller";

export const posisiRouter = Router();

posisiRouter.use(requireAuth, requireModule("manajemen-karyawan"));

posisiRouter.get("/", posisiController.list);
posisiRouter.get("/:id", posisiController.get);
posisiRouter.post("/", posisiController.create);
posisiRouter.put("/:id", posisiController.update);
posisiRouter.delete("/:id", posisiController.remove);
