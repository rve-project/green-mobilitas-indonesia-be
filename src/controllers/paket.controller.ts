import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { SqliteStore } from "../utils/sqliteStore";
import { Paket, PaketItem } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { paginate, parsePagination } from "../utils/pagination";

const store = new SqliteStore<Paket>("paket");

function normalizeItems(items: unknown): PaketItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as Partial<PaketItem>;
    if ((item.tipe !== "barang" && item.tipe !== "jasa") || !item.itemId) {
      throw new ApiError(400, "Setiap item paket harus memiliki tipe (barang/jasa) dan itemId");
    }
    return {
      tipe: item.tipe,
      itemId: item.itemId,
      satuan: item.satuan || undefined,
      qty: Number(item.qty) || 1,
      diskonTipe: item.diskonTipe === "rupiah" ? "rupiah" : "persen",
      diskonPersen: Number(item.diskonPersen) || 0,
      diskonRp: Number(item.diskonRp) || 0,
    };
  });
}

export const paketController = {
  async list(req: Request, res: Response) {
    const { search } = req.query;
    let items = await store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => p.kode.toLowerCase().includes(q) || p.nama.toLowerCase().includes(q));
    }

    const { page, limit } = parsePagination(req);
    res.json(paginate(items, page, limit));
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Paket tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { kode, nama, deskripsi, items, aktif, tampilBooking } = req.body;
    if (!nama) throw new ApiError(400, "nama wajib diisi");

    const item = await store.create({
      kode: kode || `PKT-${randomUUID().slice(0, 8).toUpperCase()}`,
      nama,
      deskripsi,
      items: normalizeItems(items),
      aktif: aktif === undefined ? true : Boolean(aktif),
      tampilBooking: tampilBooking === undefined ? true : Boolean(tampilBooking),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const { items, ...rest } = req.body;
    const item = await store.update(String(req.params.id), {
      ...rest,
      ...(items !== undefined ? { items: normalizeItems(items) } : {}),
    });
    if (!item) throw new ApiError(404, "Paket tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Paket tidak ditemukan");
    res.status(204).send();
  },
};
