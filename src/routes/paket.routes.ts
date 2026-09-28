import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { paketController } from "../controllers/paket.controller";

export const paketRouter = Router();

paketRouter.use(requireAuth, requireModule("barang-jasa"));

paketRouter.get("/", paketController.list);
paketRouter.get("/:id", paketController.get);
paketRouter.post("/", paketController.create);
paketRouter.put("/:id", paketController.update);
paketRouter.delete("/:id", paketController.remove);
