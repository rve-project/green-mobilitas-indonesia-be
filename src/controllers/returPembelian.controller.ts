import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { ReturPembelian, ReturPembelianItem } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { adjustStokLokasi, computeStatusPembayaran, pembelianNetTotal, pembelianStore } from "./pembelian.controller";
import { barangStore } from "./barang.controller";
import { supplierStore } from "./supplier.controller";

const store = new SqliteStore<ReturPembelian>("retur_pembelian");

async function applyReturToPembelian(pembelianId: string, returAmount: number) {
  let creditDelta = 0;
  let supplierId: string | undefined;

  const updated = await pembelianStore.updateWithLock(pembelianId, (current) => {
    const previousNet = pembelianNetTotal(current);
    const previousExcess = Math.max(0, current.dibayar - previousNet);

    const newReturTotal = (current.returTotal ?? 0) + returAmount;
    const newNet = pembelianNetTotal({ ...current, returTotal: newReturTotal });
    const newExcess = Math.max(0, current.dibayar - newNet);

    creditDelta = newExcess - previousExcess;
    supplierId = current.supplierId;

    return {
      returTotal: newReturTotal,
      statusPembayaran: computeStatusPembayaran(newNet, current.dibayar),
    };
  });
  if (!updated || !supplierId) return;

  if (creditDelta > 0) {
    await supplierStore.updateWithLock(supplierId, (current) => ({
      saldoKredit: (current.saldoKredit ?? 0) + creditDelta,
    }));
  }
}

async function resolveItems(pembelianId: string, rawItems: unknown): Promise<ReturPembelianItem[]> {
  const pembelian = await pembelianStore.findById(pembelianId);
  if (!pembelian) throw new ApiError(400, `Pembelian dengan id ${pembelianId} tidak ditemukan`);
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items retur tidak boleh kosong");
  }

  const result: ReturPembelianItem[] = [];
  for (const raw of rawItems) {
    const input = raw as { itemId?: string; qty?: number };
    const pembelianItem = pembelian.items.find((i) => i.itemId === input.itemId);
    if (!pembelianItem) {
      throw new ApiError(400, `Item ${input.itemId} tidak ditemukan pada pembelian tersebut`);
    }
    const qty = Number(input.qty) || 1;

    // Previously only touched the flat `stok` total, leaving stokLokasi untouched --
    // every purchase return permanently desynced the two from then on, since nothing else
    // ever reconciles them against each other on its own.
    await barangStore.updateWithLock(pembelianItem.itemId, (current) => ({
      stok: Math.max(0, current.stok - qty),
      stokLokasi:
        pembelianItem.lokasi && pembelianItem.satuan
          ? adjustStokLokasi(current.stokLokasi, pembelianItem.lokasi, pembelianItem.satuan, -qty)
          : current.stokLokasi,
    }));

    result.push({ itemId: pembelianItem.itemId, nama: pembelianItem.nama, qty, hargaSatuan: pembelianItem.hargaSatuan });
  }
  return result;
}

export const returPembelianController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Retur pembelian tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { pembelianId, tanggal, alasan, items } = req.body;
    if (!pembelianId) throw new ApiError(400, "pembelianId wajib diisi");

    const resolvedItems = await resolveItems(pembelianId, items);
    const total = resolvedItems.reduce((sum, item) => sum + item.qty * item.hargaSatuan, 0);

    await applyReturToPembelian(pembelianId, total);

    const item = await store.create({
      kode: generateKode(
        "RTP",
        (await store.findAll()).map((i) => i.kode)
      ),
      pembelianId,
      tanggal: tanggal || new Date().toISOString(),
      alasan,
      items: resolvedItems,
      total,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Retur pembelian tidak ditemukan");
    res.status(204).send();
  },
};
