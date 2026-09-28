import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { stokOpnameController } from "../controllers/stokOpname.controller";

export const stokOpnameRouter = Router();

stokOpnameRouter.use(requireAuth, requireModule("manajemen-stok"));

stokOpnameRouter.get("/", stokOpnameController.list);
stokOpnameRouter.get("/export", stokOpnameController.exportXlsx);
stokOpnameRouter.get("/:id", stokOpnameController.get);
stokOpnameRouter.post("/", stokOpnameController.create);
stokOpnameRouter.delete("/:id", stokOpnameController.remove);
