import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { karyawanController } from "../controllers/karyawan.controller";

export const karyawanRouter = Router();

karyawanRouter.use(requireAuth, requireModule("manajemen-karyawan"));

karyawanRouter.get("/", karyawanController.list);
karyawanRouter.get("/stats", karyawanController.stats);
karyawanRouter.get("/:id", karyawanController.get);
karyawanRouter.post("/", karyawanController.create);
karyawanRouter.put("/:id", karyawanController.update);
karyawanRouter.delete("/:id", karyawanController.remove);
