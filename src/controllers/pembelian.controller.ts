import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { generateKode } from "../utils/kodeGenerator";
import { PajakSetting, Pembelian, PembelianItem, Satuan, StatusPembayaran, StatusPembelian } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { barangStore } from "./barang.controller";
import { pajakSettings } from "./pengaturan.controller";
import { hitungTotalSetelahDiskon } from "../utils/diskon";

export const pembelianStore = new SqliteStore<Pembelian>("pembelian");
const store = pembelianStore;

const VALID_STATUS: StatusPembelian[] = ["selesai", "draft", "dibatalkan"];

/** Validates and builds item snapshots WITHOUT touching stock, so callers can fail before mutating anything. */
async function buildItems(rawItems: unknown): Promise<PembelianItem[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, "items tidak boleh kosong");
  }

  const result: PembelianItem[] = [];
  for (const raw of rawItems) {
    const input = raw as {
      itemId?: string;
      qty?: number;
      diskonTipe?: "persen" | "rupiah";
      diskonPersen?: number;
      diskonRp?: number;
      hargaSatuan?: number;
      lokasi?: string;
      satuan?: string;
    };
    if (!input.itemId) throw new ApiError(400, "Setiap item harus memiliki itemId");
    if (!input.lokasi) throw new ApiError(400, "Setiap item harus memiliki lokasi");

    const qty = Number(input.qty) || 1;
    const diskonTipe: "persen" | "rupiah" = input.diskonTipe === "rupiah" ? "rupiah" : "persen";
    const diskonPersen = Number(input.diskonPersen) || 0;
    const diskonRp = Number(input.diskonRp) || 0;
    const hargaOverride = Number(input.hargaSatuan) > 0 ? Number(input.hargaSatuan) : undefined;
    const lokasi = input.lokasi;

    const barang = await barangStore.findById(input.itemId);
    if (!barang) throw new ApiError(400, `Barang dengan id ${input.itemId} tidak ditemukan`);
    const satuan = input.satuan || barang.satuan;
    result.push({
      itemId: barang.id,
      nama: barang.nama,
      kode: barang.kode,
      satuan,
      qty,
      hargaSatuan: hargaOverride ?? barang.hargaBeli,
      diskonTipe,
      diskonPersen,
      diskonRp,
      lokasi,
    });
  }
  return result;
}

/** Bumps stokLokasi[lokasi+satuan] by delta (negative to subtract), creating the entry if it
 * doesn't exist yet. Mirrors penerimaanBarang.controller.ts's applyStockIn so a purchase is
 * tracked per-location the same way a goods receipt is. */
function adjustStokLokasi(
  stokLokasi: { satuan: Satuan; lokasi: string; rak?: string; jumlah: number; stokMinimum?: number; stokMaksimum?: number }[],
  lokasi: string,
  satuan: string,
  delta: number
) {
  const idx = stokLokasi.findIndex((sl) => sl.lokasi === lokasi && sl.satuan === satuan);
  if (idx === -1) {
    if (delta <= 0) return stokLokasi;
    return [...stokLokasi, { satuan: satuan as Satuan, lokasi, jumlah: delta }];
  }
  return stokLokasi.map((sl, i) => (i === idx ? { ...sl, jumlah: Math.max(0, sl.jumlah + delta) } : sl));
}

async function resolveItems(rawItems: unknown): Promise<PembelianItem[]> {
  const result = await buildItems(rawItems);
  for (const item of result) {
    await barangStore.updateWithLock(item.itemId, (current) => ({
      stok: current.stok + item.qty,
      stokLokasi: adjustStokLokasi(current.stokLokasi, item.lokasi!, item.satuan!, item.qty),
    }));
  }
  return result;
}

/** Applies the net stock delta between a pembelian's old and new item lists, per (barang, lokasi,
 * satuan) combination, one lock per affected barang. */
async function applyStockDelta(oldItems: PembelianItem[], newItems: PembelianItem[]) {
  const byItem = new Map<string, Map<string, { lokasi: string; satuan: string; delta: number }>>();

  function addDelta(item: PembelianItem, sign: 1 | -1) {
    if (!item.lokasi || !item.satuan) return;
    const locMap = byItem.get(item.itemId) ?? new Map<string, { lokasi: string; satuan: string; delta: number }>();
    const key = `${item.lokasi}::${item.satuan}`;
    const existing = locMap.get(key) ?? { lokasi: item.lokasi, satuan: item.satuan, delta: 0 };
    existing.delta += sign * item.qty;
    locMap.set(key, existing);
    byItem.set(item.itemId, locMap);
  }

  for (const old of oldItems) addDelta(old, -1);
  for (const next of newItems) addDelta(next, 1);

  for (const [itemId, locMap] of byItem) {
    const deltas = Array.from(locMap.values()).filter((d) => d.delta !== 0);
    if (deltas.length === 0) continue;
    const totalDelta = deltas.reduce((s, d) => s + d.delta, 0);
    await barangStore.updateWithLock(itemId, (current) => {
      let stokLokasi = current.stokLokasi;
      for (const d of deltas) {
        stokLokasi = adjustStokLokasi(stokLokasi, d.lokasi, d.satuan, d.delta);
      }
      return { stok: current.stok + totalDelta, stokLokasi };
    });
  }
}

function roundToNearest(value: number, step: number) {
  if (!step) return value;
  return Math.round(value / step) * step;
}

function computeTotals(items: PembelianItem[], potonganPersen: number, pajak: PajakSetting, bebasPpn: boolean) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + hitungTotalSetelahDiskon(item.qty * item.hargaSatuan, item.diskonTipe, item.diskonPersen, item.diskonRp ?? 0),
    0
  );
  const dpp = subtotal * (1 - potonganPersen / 100);
  const pajakPersen = !bebasPpn && pajak.aktif ? pajak.persentase : 0;
  const pajakNominal = roundToNearest(dpp * (pajakPersen / 100), pajak.pembulatan);
  return { subtotal, dpp, pajakPersen, pajak: pajakNominal };
}

export function computeStatusPembayaran(total: number, dibayar: number): StatusPembayaran {
  if (total <= 0) return "lunas";
  if (dibayar <= 0) return "belum_dibayar";
  if (dibayar >= total) return "lunas";
  return "dibayar_setengah";
}

export function pembelianNetTotal(pembelian: Pembelian): number {
  return Math.max(0, pembelian.total - (pembelian.returTotal ?? 0));
}

export const pembelianController = {
  async list(_req: Request, res: Response) {
    res.json(await store.findAll());
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Pembelian tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const {
      supplierId,
      tanggal,
      items,
      status,
      dibayar,
      jatuhTempoHari,
      jatuhTempo: jatuhTempoOverride,
      syaratPembayaran,
      noInvoiceSupplier,
      catatan,
      potonganPersen,
      biayaPengiriman,
      biayaLainnya,
      metodePembayaran,
      catatanPembayaran,
      bebasPpn,
    } = req.body;
    if (!supplierId) throw new ApiError(400, "supplierId wajib diisi");

    const resolvedItems = await resolveItems(items);
    const potongan = Number(potonganPersen) || 0;
    const ongkir = Number(biayaPengiriman) || 0;
    const lainnya = Number(biayaLainnya) || 0;
    const isBebasPpn = Boolean(bebasPpn);
    const { subtotal, dpp, pajakPersen, pajak } = computeTotals(resolvedItems, potongan, await pajakSettings.get(), isBebasPpn);
    const total = dpp + pajak + ongkir + lainnya;
    const paid = Number(dibayar) || 0;

    const tanggalPembelian = tanggal || new Date().toISOString();
    let jatuhTempo: string;
    if (jatuhTempoOverride) {
      jatuhTempo = new Date(jatuhTempoOverride).toISOString();
    } else {
      const hariTempo = jatuhTempoHari === undefined ? 30 : Number(jatuhTempoHari);
      jatuhTempo = new Date(new Date(tanggalPembelian).getTime() + hariTempo * 24 * 60 * 60 * 1000).toISOString();
    }

    const item = await store.create({
      kode: generateKode(
        "PB",
        (await store.findAll()).map((i) => i.kode)
      ),
      supplierId,
      tanggal: tanggalPembelian,
      jatuhTempo,
      syaratPembayaran: syaratPembayaran || undefined,
      noInvoiceSupplier: noInvoiceSupplier || undefined,
      catatan: catatan || undefined,
      metodePembayaran: metodePembayaran || undefined,
      catatanPembayaran: catatanPembayaran || undefined,
      items: resolvedItems,
      potonganPersen: potongan,
      subtotal,
      dpp,
      bebasPpn: isBebasPpn,
      pajakPersen,
      pajak,
      biayaPengiriman: ongkir,
      biayaLainnya: lainnya,
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
    if (!existing) throw new ApiError(404, "Pembelian tidak ditemukan");

    const { status, dibayar, items, potonganPersen, bebasPpn, biayaPengiriman, biayaLainnya, ...rest } = req.body;
    const patch: Partial<Pembelian> = { ...rest };

    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        throw new ApiError(400, `status harus salah satu dari: ${VALID_STATUS.join(", ")}`);
      }
      patch.status = status;
    }

    let netTotal = pembelianNetTotal(existing);
    const bebasPpnEfektif = bebasPpn !== undefined ? Boolean(bebasPpn) : existing.bebasPpn ?? false;

    if (items !== undefined) {
      // Validate/build the new item list BEFORE touching any stock, so a bad itemId can't leave stock half-adjusted.
      const newItems = await buildItems(items);
      const potongan = potonganPersen !== undefined ? Number(potonganPersen) || 0 : existing.potonganPersen ?? 0;
      const ongkir = biayaPengiriman !== undefined ? Number(biayaPengiriman) || 0 : existing.biayaPengiriman ?? 0;
      const lainnya = biayaLainnya !== undefined ? Number(biayaLainnya) || 0 : existing.biayaLainnya ?? 0;
      const { subtotal, dpp, pajakPersen, pajak } = computeTotals(newItems, potongan, await pajakSettings.get(), bebasPpnEfektif);
      const total = dpp + pajak + ongkir + lainnya;

      await applyStockDelta(existing.items, newItems);

      patch.items = newItems;
      patch.potonganPersen = potongan;
      patch.subtotal = subtotal;
      patch.dpp = dpp;
      patch.bebasPpn = bebasPpnEfektif;
      patch.pajakPersen = pajakPersen;
      patch.pajak = pajak;
      patch.biayaPengiriman = ongkir;
      patch.biayaLainnya = lainnya;
      patch.total = total;
      netTotal = Math.max(0, total - (existing.returTotal ?? 0));
    } else {
      if (potonganPersen !== undefined) patch.potonganPersen = Number(potonganPersen) || 0;
      if (bebasPpn !== undefined) patch.bebasPpn = bebasPpnEfektif;
      if (biayaPengiriman !== undefined) patch.biayaPengiriman = Number(biayaPengiriman) || 0;
      if (biayaLainnya !== undefined) patch.biayaLainnya = Number(biayaLainnya) || 0;
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
    if (!existing) throw new ApiError(404, "Pembelian tidak ditemukan");

    if (existing.dibayar > 0) {
      throw new ApiError(400, "Pembelian ini sudah memiliki pembayaran dan tidak bisa dihapus.");
    }
    if ((existing.returTotal ?? 0) > 0) {
      throw new ApiError(400, "Pembelian ini memiliki retur pembelian dan tidak bisa dihapus.");
    }

    // Deleting an unpaid, unreturned pembelian reverses its stock addition so barang counts stay correct.
    for (const item of existing.items) {
      await barangStore.updateWithLock(item.itemId, (current) => ({
        stok: current.stok - item.qty,
        stokLokasi: item.lokasi && item.satuan ? adjustStokLokasi(current.stokLokasi, item.lokasi, item.satuan, -item.qty) : current.stokLokasi,
      }));
    }

    const deleted = await store.delete(existing.id);
    if (!deleted) throw new ApiError(404, "Pembelian tidak ditemukan");
    res.status(204).send();
  },
};
