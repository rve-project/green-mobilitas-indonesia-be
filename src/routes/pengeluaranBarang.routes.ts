import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { pengeluaranBarangController } from "../controllers/pengeluaranBarang.controller";

export const pengeluaranBarangRouter = Router();

pengeluaranBarangRouter.use(requireAuth, requireModule("manajemen-stok"));

pengeluaranBarangRouter.get("/", pengeluaranBarangController.list);
pengeluaranBarangRouter.get("/:id", pengeluaranBarangController.get);
pengeluaranBarangRouter.post("/", pengeluaranBarangController.create);
pengeluaranBarangRouter.put("/:id", pengeluaranBarangController.update);
pengeluaranBarangRouter.delete("/:id", pengeluaranBarangController.remove);
