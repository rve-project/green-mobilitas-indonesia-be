import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { lokasiController } from "../controllers/lokasi.controller";

export const lokasiRouter = Router();

lokasiRouter.use(requireAuth, requireModule("pengaturan"));

lokasiRouter.get("/", lokasiController.list);
lokasiRouter.get("/:id", lokasiController.get);
lokasiRouter.post("/", lokasiController.create);
lokasiRouter.put("/:id", lokasiController.update);
lokasiRouter.delete("/:id", lokasiController.remove);
