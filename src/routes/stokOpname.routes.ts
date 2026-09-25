import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MODULE_ROLES } from "../config/permissions";
import { stokOpnameController } from "../controllers/stokOpname.controller";

export const stokOpnameRouter = Router();

stokOpnameRouter.use(requireAuth, requireRole(...MODULE_ROLES["manajemen-stok"]));

stokOpnameRouter.get("/", stokOpnameController.list);
stokOpnameRouter.get("/export", stokOpnameController.exportXlsx);
stokOpnameRouter.get("/:id", stokOpnameController.get);
stokOpnameRouter.post("/", stokOpnameController.create);
stokOpnameRouter.delete("/:id", stokOpnameController.remove);
