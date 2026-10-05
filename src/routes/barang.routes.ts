import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { barangController } from "../controllers/barang.controller";
import { uploadXlsx } from "../middlewares/upload";

export const barangRouter = Router();

barangRouter.use(requireAuth, requireModule("barang-jasa"));

barangRouter.get("/template", barangController.template);
barangRouter.get("/export", barangController.exportXlsx);
barangRouter.post("/import", uploadXlsx, barangController.importXlsx);
barangRouter.get("/stok-lokasi/reconcile-preview", barangController.reconcileStokLokasiPreview);
barangRouter.post("/stok-lokasi/reconcile", barangController.reconcileStokLokasi);
barangRouter.get("/orphaned-items/preview", barangController.orphanedItemsPreview);
barangRouter.post("/orphaned-items/restore", barangController.restoreOrphanedItems);
barangRouter.get("/", barangController.list);
barangRouter.get("/:id", barangController.get);
barangRouter.get("/:id/riwayat-stok", barangController.riwayatStok);
barangRouter.post("/", barangController.create);
barangRouter.put("/:id", barangController.update);
barangRouter.delete("/:id", barangController.remove);
