import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { penerimaanBarangController } from "../controllers/penerimaanBarang.controller";

export const penerimaanBarangRouter = Router();

penerimaanBarangRouter.use(requireAuth, requireModule("manajemen-stok"));

penerimaanBarangRouter.get("/", penerimaanBarangController.list);
penerimaanBarangRouter.get("/:id", penerimaanBarangController.get);
penerimaanBarangRouter.post("/", penerimaanBarangController.create);
penerimaanBarangRouter.put("/:id", penerimaanBarangController.update);
penerimaanBarangRouter.delete("/:id", penerimaanBarangController.remove);
