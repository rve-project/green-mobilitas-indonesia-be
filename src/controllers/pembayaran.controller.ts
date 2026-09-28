import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { Pembayaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { computeStatusPembayaran, invoiceNetTotal, invoiceStore } from "./invoice.controller";

const store = new SqliteStore<Pembayaran>("pembayaran");

export const pembayaranController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async create(req: Request, res: Response) {
    const { invoiceId, tanggal, jumlah, metode, catatan } = req.body;
    if (!invoiceId || !jumlah) throw new ApiError(400, "invoiceId dan jumlah wajib diisi");
    const jumlahNum = Number(jumlah);
    if (!(jumlahNum > 0)) throw new ApiError(400, "jumlah harus lebih dari 0");

    const invoiceExists = await invoiceStore.findById(invoiceId);
    if (!invoiceExists) throw new ApiError(400, `Invoice dengan id ${invoiceId} tidak ditemukan`);

    const item = await store.create({
      invoiceId,
      tanggal: tanggal || new Date().toISOString(),
      jumlah: jumlahNum,
      metode,
      catatan: catatan || undefined,
      createdAt: new Date().toISOString(),
    });

    // Row-locked so two concurrent payments on the same invoice can't clobber each other's dibayar update.
    await invoiceStore.updateWithLock(invoiceId, (current) => {
      const dibayarBaru = current.dibayar + jumlahNum;
      return {
        dibayar: dibayarBaru,
        statusPembayaran: computeStatusPembayaran(invoiceNetTotal(current), dibayarBaru),
      };
    });

    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Pembayaran tidak ditemukan");

    const { tanggal, jumlah, metode, catatan } = req.body;
    const patch: Partial<Pembayaran> = {};
    if (tanggal !== undefined) patch.tanggal = tanggal;
    if (metode !== undefined) patch.metode = metode;
    if (catatan !== undefined) patch.catatan = catatan || undefined;

    let jumlahBaru = existing.jumlah;
    if (jumlah !== undefined) {
      jumlahBaru = Number(jumlah);
      if (!(jumlahBaru > 0)) throw new ApiError(400, "jumlah harus lebih dari 0");
      patch.jumlah = jumlahBaru;
    }

    const delta = jumlahBaru - existing.jumlah;
    if (delta !== 0) {
      // Row-locked so the invoice's running `dibayar` total can't be clobbered by a concurrent payment.
      await invoiceStore.updateWithLock(existing.invoiceId, (current) => {
        const dibayarBaru = current.dibayar + delta;
        return {
          dibayar: dibayarBaru,
          statusPembayaran: computeStatusPembayaran(invoiceNetTotal(current), dibayarBaru),
        };
      });
    }

    const updated = await store.update(existing.id, patch);
    res.json(updated);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pembayaran tidak ditemukan");
    res.status(204).send();
  },
};
