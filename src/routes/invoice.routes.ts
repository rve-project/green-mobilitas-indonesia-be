import { Router } from "express";
import { requireAuth, requireModule } from "../middlewares/auth";
import { invoiceController } from "../controllers/invoice.controller";

export const invoiceRouter = Router();

invoiceRouter.use(requireAuth, requireModule("penjualan"));

invoiceRouter.get("/", invoiceController.list);
invoiceRouter.get("/:id", invoiceController.get);
invoiceRouter.post("/", invoiceController.create);
invoiceRouter.put("/:id", invoiceController.update);
invoiceRouter.delete("/:id", invoiceController.remove);
