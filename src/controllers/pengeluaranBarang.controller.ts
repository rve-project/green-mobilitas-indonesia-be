import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { PengeluaranBarang, PengeluaranBarangItem, StatusPengeluaranBarang } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";

export const pengeluaranBarangStore = new SqliteStore<PengeluaranBarang>("pengeluaran_barang");
const store = pengeluaranBarangStore;

const VALID_STATUS: StatusPengeluaranBarang[] = ["draft", "terposting"];

async function resolveItems(rawItems: unknown): Promise<PengeluaranBarangItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "Detail item tidak boleh kosong");
  }

  const result: PengeluaranBarangItem[] = [];
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

async function ensureStockAvailable(items: PengeluaranBarangItem[]) {
  for (const item of items) {
    const barang = await barangStore.findById(item.itemId);
    if (!barang) continue;
    const entry = barang.stokLokasi.find((sl) => sl.lokasi === item.lokasi && sl.satuan === item.satuan);
    const tersedia = entry?.jumlah ?? 0;
    if (item.jumlah > tersedia) {
      throw new ApiError(
        400,
        `Stok ${item.nama} di ${item.lokasi} tidak mencukupi (tersedia ${tersedia}, diminta ${item.jumlah})`
      );
    }
  }
}

async function applyStockOut(items: PengeluaranBarangItem[]) {
  for (const item of items) {
    await barangStore.updateWithLock(item.itemId, (current) => {
      const entry = current.stokLokasi.find((sl) => sl.lokasi === item.lokasi && sl.satuan === item.satuan);
      const tersedia = entry?.jumlah ?? 0;
      if (item.jumlah > tersedia) {
        throw new ApiError(
          400,
          `Stok ${item.nama} di ${item.lokasi} tidak mencukupi (tersedia ${tersedia}, diminta ${item.jumlah})`
        );
      }
      const stokLokasi = current.stokLokasi.map((sl) =>
        sl.lokasi === item.lokasi && sl.satuan === item.satuan ? { ...sl, jumlah: sl.jumlah - item.jumlah } : sl
      );
      // Already validated against the location's own qty above, but the flat total can
      // still be stale relative to it (e.g. from the same gap this clamp just closed in
      // invoice/penerimaan-barang's own stock math) -- flooring here too stops that drift
      // from compounding instead of fixing it.
      return { stok: Math.max(0, current.stok - item.jumlah), stokLokasi };
    });
  }
}

export const pengeluaranBarangController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { tanggal, alasan, catatan, items, status } = req.body;
    if (!alasan) throw new ApiError(400, "Alasan wajib diisi");

    const resolvedItems = await resolveItems(items);
    const finalStatus: StatusPengeluaranBarang = status && VALID_STATUS.includes(status) ? status : "terposting";
    if (finalStatus === "terposting") {
      await ensureStockAvailable(resolvedItems);
      await applyStockOut(resolvedItems);
    }

    const item = await store.create({
      kode: generateKode(
        "GI",
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
    if (!existing) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");

    const { status } = req.body;
    if (status !== undefined && !VALID_STATUS.includes(status)) {
      throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
    }

    const patch: Partial<PengeluaranBarang> = {};
    if (status === "terposting" && existing.status === "draft") {
      await ensureStockAvailable(existing.items);
      await applyStockOut(existing.items);
      patch.status = "terposting";
      patch.postedAt = new Date().toISOString();
    }

    const item = await store.update(existing.id, patch);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Pengeluaran barang tidak ditemukan");
    res.status(204).send();
  },
};
