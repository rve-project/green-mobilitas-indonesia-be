import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { PenerimaanBarang, PenerimaanBarangItem, Satuan, StatusPenerimaanBarang } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";

export const penerimaanBarangStore = new SqliteStore<PenerimaanBarang>("penerimaan_barang");
const store = penerimaanBarangStore;

const VALID_STATUS: StatusPenerimaanBarang[] = ["draft", "terposting"];

async function resolveItems(rawItems: unknown): Promise<PenerimaanBarangItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "Detail item tidak boleh kosong");
  }

  const result: PenerimaanBarangItem[] = [];
  for (const raw of rawItems) {
    const input = raw as {
      itemId?: string;
      satuan?: string;
      lokasi?: string;
      jumlah?: number;
      hargaSatuan?: number;
      catatan?: string;
    };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");
    if (!input.lokasi) throw new ApiError(400, "Setiap item harus memiliki lokasi");

    const barang = await barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);

    const jumlah = Number(input.jumlah) || 0;
    if (jumlah <= 0) throw new ApiError(400, `Jumlah untuk ${barang.nama} harus lebih dari 0`);

    result.push({
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan: input.satuan || barang.satuan,
      lokasi: input.lokasi,
      jumlah,
      hargaSatuan: Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined,
      catatan: input.catatan || undefined,
    });
  }
  return result;
}

async function applyStockIn(items: PenerimaanBarangItem[]) {
  for (const item of items) {
    await barangStore.updateWithLock(item.itemId, (current) => {
      const hasEntry = current.stokLokasi.some((sl) => sl.lokasi === item.lokasi && sl.satuan === item.satuan);
      const stokLokasi = hasEntry
        ? current.stokLokasi.map((sl) =>
            sl.lokasi === item.lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: sl.jumlah + item.jumlah } : sl
          )
        : [...current.stokLokasi, { satuan: item.satuan as Satuan, lokasi: item.lokasi, jumlah: item.jumlah }];

      return { stok: current.stok + item.jumlah, stokLokasi };
    });
  }
}

export const penerimaanBarangController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Penerimaan barang tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { tanggal, alasan, catatan, items, status } = req.body;
    if (!alasan) throw new ApiError(400, "Alasan wajib diisi");

    const resolvedItems = await resolveItems(items);
    const finalStatus: StatusPenerimaanBarang = status && VALID_STATUS.includes(status) ? status : "terposting";
    if (finalStatus === "terposting") await applyStockIn(resolvedItems);

    const item = await store.create({
      kode: generateKode(
        "GR",
        (await store.findAll()).map((i) => i.kode)
      ),
      tanggal: tanggal || new Date().toISOString(),
      alasan,
      catatan: catatan || undefined,
      items: resolvedItems,
      status: finalStatus,
      dibuatOleh: req.authUser?.nama,
      postedAt: finalStatus === "terposting" ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Penerimaan barang tidak ditemukan");

    const { status } = req.body;
    if (status !== undefined && !VALID_STATUS.includes(status)) {
      throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
    }

    const patch: Partial<PenerimaanBarang> = {};
    if (status === "terposting" && existing.status === "draft") {
      await applyStockIn(existing.items);
      patch.status = "terposting";
      patch.postedAt = new Date().toISOString();
    }

    const item = await store.update(existing.id, patch);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Penerimaan barang tidak ditemukan");

    // Only a posted receipt ever touched stock (see create/update above) -- a draft never
    // did, so reversing one would incorrectly subtract stock that was never added.
    if (existing.status === "terposting") {
      for (const item of existing.items) {
        await barangStore.updateWithLock(item.itemId, (current) => {
          // Dropping a location entry to zero removes it entirely (rather than leaving a
          // {jumlah: 0} stub) so a barang that's never really been through location
          // tracking reads that way again, not as "tracked, currently empty here".
          const stokLokasi = current.stokLokasi
            .map((sl) => (sl.lokasi === item.lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: sl.jumlah - item.jumlah } : sl))
            .filter((sl) => sl.jumlah > 0);
          return { stok: current.stok - item.jumlah, stokLokasi };
        });
      }
    }

    const deleted = await store.delete(existing.id);
    if (!deleted) throw new ApiError(404, "Penerimaan barang tidak ditemukan");
    res.status(204).send();
  },
};
