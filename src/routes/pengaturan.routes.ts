import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { companyProfileController, lookupController, pajakController } from "../controllers/pengaturan.controller";

export const pengaturanRouter = Router();

pengaturanRouter.use(requireAuth, requireModule("pengaturan"));

pengaturanRouter.get("/lookup", lookupController.list);
pengaturanRouter.post("/lookup", lookupController.create);
pengaturanRouter.put("/lookup/:id", lookupController.update);
pengaturanRouter.delete("/lookup/:id", lookupController.remove);

pengaturanRouter.get("/pajak", pajakController.get);
pengaturanRouter.put("/pajak", pajakController.update);

pengaturanRouter.put("/profil-perusahaan", companyProfileController.update);
