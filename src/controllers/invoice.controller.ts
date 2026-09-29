import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { Invoice, InvoiceItem, PajakSetting, StatusInvoice, StatusPembayaran } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";
import { jasaStore } from "./jasa.controller";
import { pajakSettings } from "./pengaturan.controller";
import { hitungTotalSetelahDiskon } from "../utils/diskon";

export const invoiceStore = new SqliteStore<Invoice>("invoice");
const store = invoiceStore;

const VALID_STATUS: StatusInvoice[] = ["selesai", "draft", "dibatalkan"];

/** Validates and builds item snapshots WITHOUT touching stock, so callers can fail before mutating anything. */
async function buildItems(rawItems: unknown): Promise<InvoiceItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  const result: InvoiceItem[] = [];
  for (const raw of rawItems) {
    const input = raw as {
      tipe?: string;
      itemId?: string;
      qty?: number;
      diskonTipe?: "persen" | "rupiah";
      diskonPersen?: number;
      diskonRp?: number;
      hargaSatuan?: number;
      lokasi?: string;
      satuan?: string;
    };
    if ((input.tipe !== "barang" && input.tipe !== "jasa") || !input.itemId) {
      throw new ApiError(400, "Setiap item harus memiliki tipe (barang/jasa) dan itemId");
    }

    const qty = Number(input.qty) || 1;
    const diskonTipe: "persen" | "rupiah" = input.diskonTipe === "rupiah" ? "rupiah" : "persen";
    const diskonPersen = Number(input.diskonPersen) || 0;
    const diskonRp = Number(input.diskonRp) || 0;
    const hargaOverride = Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined;
    const lokasi = input.lokasi || undefined;

    if (input.tipe === "barang") {
      const barang = await barangStore.findById(input.itemId);
      if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);
      result.push({
        tipe: "barang",
        itemId: barang.id,
        nama: barang.nama,
        kode: barang.kode,
        satuan: input.satuan || undefined,
        qty,
        hargaSatuan: hargaOverride ?? barang.hargaJual,
        diskonTipe,
        diskonPersen,
        diskonRp,
        lokasi,
      });
      continue;
    }

    const jasa = await jasaStore.findById(input.itemId);
    if (!jasa) throw new ApiError(400, `Jasa dengan id ${input.itemId} tidak ditemukan`);
    result.push({
      tipe: "jasa",
      itemId: jasa.id,
      nama: jasa.nama,
      kode: jasa.kode,
      qty,
      hargaSatuan: hargaOverride ?? jasa.harga,
      diskonTipe,
      diskonPersen,
      diskonRp,
    });
  }
  return result;
}

async function resolveItems(rawItems: unknown): Promise<InvoiceItem[]> {
  const result = await buildItems(rawItems);
  for (const item of result) {
    if (item.tipe === "barang") {
      await barangStore.updateWithLock(item.itemId, (current) => ({ stok: current.stok - item.qty }));
    }
  }
  return result;
}

/** Applies the net stock delta between an invoice's old and new item lists, one lock per affected barang. */
async function applyStockDelta(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const deltaQty = new Map<string, number>();
  for (const old of oldItems) {
    if (old.tipe === "barang") deltaQty.set(old.itemId, (deltaQty.get(old.itemId) ?? 0) - old.qty);
  }
  for (const next of newItems) {
    if (next.tipe === "barang") deltaQty.set(next.itemId, (deltaQty.get(next.itemId) ?? 0) + next.qty);
  }
  for (const [itemId, delta] of deltaQty) {
    if (delta === 0) continue;
    await barangStore.updateWithLock(itemId, (current) => ({ stok: current.stok - delta }));
  }
}

function roundToNearest(value: number, step: number) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function computeTotals(items: InvoiceItem[], potonganPersen: number, pajak: PajakSetting, bebasPpn: boolean) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + hitungTotalSetelahDiskon(item.qty * item.hargaSatuan, item.diskonTipe, item.diskonPersen, item.diskonRp ?? 0),
    0
  );
  const dpp = subtotal * (1 - potonganPersen / 100);
  const pajakPersen = !bebasPpn && pajak.aktif ? pajak.persentase : 0;
  const pajakNominal = roundToNearest(dpp * (pajakPersen / 100), pajak.pembulatan);
  const total = dpp + pajakNominal;
  return { subtotal, dpp, pajakPersen, pajak: pajakNominal, total };
}

export function computeStatusPembayaran(total: number, dibayar: number): StatusPembayaran {
  if (total <= 0) return "lunas";
  if (dibayar <= 0) return "belum_dibayar";
  if (dibayar >= total) return "lunas";
  return "dibayar_setengah";
}

export function invoiceNetTotal(invoice: Invoice): number {
  return Math.max(0, invoice.total - (invoice.returTotal ?? 0));
}

export const invoiceController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Invoice tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const {
      pelangganId,
      kendaraanIds,
      kilometer,
      tanggal,
      items,
      status,
      dibayar,
      jatuhTempoHari,
      jatuhTempo: jatuhTempoOverride,
      syaratPembayaran,
      catatan,
      keluhan,
      potonganPersen,
      bebasPpn,
    } = req.body;
    if (!pelangganId) throw new ApiError(400, "pelangganId wajib diisi");

    const resolvedItems = await resolveItems(items);
    const potongan = Number(potonganPersen) || 0;
    const isBebasPpn = Boolean(bebasPpn);
    const { subtotal, dpp, pajakPersen, pajak, total } = computeTotals(
      resolvedItems,
      potongan,
      await pajakSettings.get(),
      isBebasPpn
    );
    const paid = Number(dibayar) || 0;

    const tanggalInvoice = tanggal || new Date().toISOString();
    let jatuhTempo: string;
    if (jatuhTempoOverride) {
      jatuhTempo = new Date(jatuhTempoOverride).toISOString();
    } else {
      const hariTempo = jatuhTempoHari === undefined ? 30 : Number(jatuhTempoHari);
      jatuhTempo = new Date(new Date(tanggalInvoice).getTime() + hariTempo * 24 * 60 * 60 * 1000).toISOString();
    }

    const item = await store.create({
      kode: generateKode(
        "SL",
        (await store.findAll()).map((i) => i.kode)
      ),
      pelangganId,
      kendaraanIds: Array.isArray(kendaraanIds) ? kendaraanIds.filter((id) => typeof id === "string") : undefined,
      kilometer: Number(kilometer) > 0 ? Number(kilometer) : undefined,
      tanggal: tanggalInvoice,
      jatuhTempo,
      syaratPembayaran: syaratPembayaran || undefined,
      catatan: catatan || undefined,
      keluhan: keluhan || undefined,
      items: resolvedItems,
      potonganPersen: potongan,
      subtotal,
      dpp,
      bebasPpn: isBebasPpn,
      pajakPersen,
      pajak,
      total,
      dibayar: paid,
      status: status && VALID_STATUS.includes(status) ? status : "selesai",
      statusPembayaran: computeStatusPembayaran(total, paid),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Invoice tidak ditemukan");

    const { status, dibayar, items, potonganPersen, bebasPpn, ...rest } = req.body;
    const patch: Partial<Invoice> = { ...rest };

    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
      }
      patch.status = status;
    }

    let netTotal = invoiceNetTotal(existing);
    const bebasPpnEfektif = bebasPpn !== undefined ? Boolean(bebasPpn) : existing.bebasPpn ?? false;

    if (items !== undefined) {
      // Validate/build the new item list BEFORE touching any stock, so a bad itemId can't leave stock half-adjusted.
      const newItems = await buildItems(items);
      const potongan = potonganPersen !== undefined ? Number(potonganPersen) || 0 : existing.potonganPersen ?? 0;
      const { subtotal, dpp, pajakPersen, pajak, total } = computeTotals(
        newItems,
        potongan,
        await pajakSettings.get(),
        bebasPpnEfektif
      );

      await applyStockDelta(existing.items, newItems);

      patch.items = newItems;
      patch.potonganPersen = potongan;
      patch.subtotal = subtotal;
      patch.dpp = dpp;
      patch.bebasPpn = bebasPpnEfektif;
      patch.pajakPersen = pajakPersen;
      patch.pajak = pajak;
      patch.total = total;
      netTotal = Math.max(0, total - (existing.returTotal ?? 0));
    } else {
      if (potonganPersen !== undefined) patch.potonganPersen = Number(potonganPersen) || 0;
      if (bebasPpn !== undefined) patch.bebasPpn = bebasPpnEfektif;
    }

    if (dibayar !== undefined) {
      patch.dibayar = Number(dibayar) || 0;
      patch.statusPembayaran = computeStatusPembayaran(netTotal, patch.dibayar);
    } else if (items !== undefined) {
      patch.statusPembayaran = computeStatusPembayaran(netTotal, existing.dibayar);
    }

    const item = await store.update(existing.id, patch);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const existing = await store.findById(String(req.params.id));
    if (!existing) throw new ApiError(404, "Invoice tidak ditemukan");

    if (existing.dibayar > 0) {
      throw new ApiError(400, "Invoice ini sudah memiliki pembayaran dan tidak bisa dihapus.");
    }
    if ((existing.returTotal ?? 0) > 0) {
      throw new ApiError(400, "Invoice ini memiliki retur penjualan dan tidak bisa dihapus.");
    }

    // Deleting an unpaid, unreturned invoice reverses its stock deduction so barang counts stay correct.
    for (const item of existing.items) {
      if (item.tipe === "barang") {
        await barangStore.updateWithLock(item.itemId, (current) => ({ stok: current.stok + item.qty }));
      }
    }

    const deleted = await store.delete(existing.id);
    if (!deleted) throw new ApiError(404, "Invoice tidak ditemukan");
    res.status(204).send();
  },
};
