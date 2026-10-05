import { Request, Response } from "express";
import { Barang, BarangStokLokasi, BarangUnit, Invoice, PembelianItem, Satuan, SATUAN_OPTIONS, StokOpname } from "../models/types";
import { SqliteStore } from "../utils/sqliteStore";
import { pool } from "../db";
import { ApiError } from "../middlewares/errorHandler";
import { paginate, parsePagination } from "../utils/pagination";
import { buildExportWorkbook, buildTemplateWorkbook, hasSheet, ImportSummary, parseSheetRows, sendXlsx } from "../utils/excel";
import { ensureLookup } from "../utils/ensureLookup";
import { ensureSupplier, supplierStore } from "./supplier.controller";
import { importJasaRows } from "./jasa.controller";

const TEMPLATE_HEADERS = [
  "Kode",
  "Nama",
  "Kategori",
  "Jenis",
  "Grup",
  "Brand",
  "Model",
  "Supplier",
  "Unit",
  "Harga Beli",
  "Harga Jual",
  "Stok Awal",
  "Deskripsi",
  "Tampil di Booking (Ya/Tidak)",
  "Aktif (Ya/Tidak)",
];
const TEMPLATE_INSTRUCTIONS = [
  "[WAJIB] bila kode sudah ada, data barang akan diperbarui (replace)",
  "[WAJIB]",
  "[WAJIB]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional]",
  "[Opsional] nama supplier; dibuat otomatis di menu Supplier bila belum terdaftar",
  "[WAJIB] salah satu: " + SATUAN_OPTIONS.join(", "),
  "[Opsional] angka",
  "[Opsional] angka",
  "[Opsional] angka, default 0",
  "[Opsional]",
  "[Opsional] default Tidak",
  "[Opsional] default Ya",
];

export const barangStore = new SqliteStore<Barang>("barang");
const store = barangStore;

const TARGET_LOKASI = "GMI Harapan Indah";

/** Raw read of another store's table, for transaction types whose store isn't exported from
 * their own controller -- avoids widening those controllers' public surface just for this. */
async function rawFindAll<T>(table: string): Promise<T[]> {
  const [rows] = await pool.query(`SELECT data FROM \`${table}\``);
  return (rows as { data: string }[]).map((row) => JSON.parse(row.data) as T);
}

interface OrphanedBarang {
  itemId: string;
  kode: string;
  nama: string;
  satuan: Satuan;
  hargaBeli: number;
  stok: number;
}

/** A "barang" itemId is only ever referenced by Pembelian/PenerimaanBarang if it really was a
 * barang (you can't purchase or receive a jasa) -- so those two are the reliable anchor for
 * "this used to be a real barang that's now missing from the catalog" (most likely deleted
 * after being referenced). Stock is reconstructed by replaying every flow that would normally
 * have kept barang.stok in sync, the same set of flows adjustStokLokasi() covers elsewhere. */
async function findOrphanedBarang(): Promise<OrphanedBarang[]> {
  const [pembelianAll, returPembelianAll, invoiceAll, returAll, penerimaanAll, pengeluaranAll, allBarang] = await Promise.all([
    rawFindAll<{ items: PembelianItem[] }>("pembelian"),
    rawFindAll<{ items: { itemId: string; qty: number }[] }>("retur_pembelian"),
    rawFindAll<Invoice>("invoice"),
    rawFindAll<{ items: { itemId: string; qty: number }[] }>("retur"),
    rawFindAll<{ status: string; items: { itemId: string; nama: string; kode: string; satuan: string; jumlah: number; hargaSatuan?: number }[] }>(
      "penerimaan_barang"
    ),
    rawFindAll<{ status: string; items: { itemId: string; jumlah: number }[] }>("pengeluaran_barang"),
    store.findAll(),
  ]);

  const knownIds = new Set(allBarang.map((b) => b.id));
  const candidateIds = new Set<string>();
  pembelianAll.forEach((p) => p.items.forEach((it) => candidateIds.add(it.itemId)));
  penerimaanAll.forEach((pb) => pb.items.forEach((it) => candidateIds.add(it.itemId)));

  const orphaned: OrphanedBarang[] = [];
  for (const itemId of candidateIds) {
    if (knownIds.has(itemId)) continue;

    let stok = 0;
    let kode = "";
    let nama = "";
    let satuan: Satuan = "PCS";
    let hargaBeli = 0;

    pembelianAll.forEach((p) =>
      p.items.forEach((it) => {
        if (it.itemId !== itemId) return;
        stok += it.qty;
        kode = it.kode || kode;
        nama = it.nama;
        satuan = (it.satuan as Satuan) || satuan;
        hargaBeli = it.hargaSatuan || hargaBeli;
      })
    );
    returPembelianAll.forEach((r) => r.items.forEach((it) => it.itemId === itemId && (stok -= it.qty)));
    invoiceAll.forEach((inv) => inv.items.forEach((it) => it.itemId === itemId && it.tipe === "barang" && (stok -= it.qty)));
    returAll.forEach((r) => r.items.forEach((it) => it.itemId === itemId && (stok += it.qty)));
    penerimaanAll.forEach((pb) => {
      if (pb.status !== "terposting") return;
      pb.items.forEach((it) => {
        if (it.itemId !== itemId) return;
        stok += it.jumlah;
        kode = it.kode || kode;
        nama = it.nama;
        satuan = (it.satuan as Satuan) || satuan;
      });
    });
    pengeluaranAll.forEach((pg) => {
      if (pg.status !== "terposting") return;
      pg.items.forEach((it) => it.itemId === itemId && (stok -= it.jumlah));
    });

    orphaned.push({ itemId, kode: kode || `ORPHAN-${itemId.slice(0, 8)}`, nama: nama || "(nama tidak diketahui)", satuan, hargaBeli, stok: Math.max(0, stok) });
  }

  return orphaned.sort((a, b) => a.kode.localeCompare(b.kode));
}

function normalizeUnits(rawUnits: unknown): BarangUnit[] {
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
    throw new ApiError(400, "Minimal satu unit wajib diisi");
  }
  return rawUnits.map((raw) => {
    const u = raw as Partial<BarangUnit>;
    if (!u.satuan || !SATUAN_OPTIONS.includes(u.satuan)) {
      throw new ApiError(400, `satuan harus salah satu dari: ${SATUAN_OPTIONS.join(", ")}`);
    }
    return {
      satuan: u.satuan,
      hargaBeli: Number(u.hargaBeli) || 0,
      hargaJual: Number(u.hargaJual) || 0,
      conversionFactor: Number(u.conversionFactor) || 1,
      komisi: u.komisi !== undefined && u.komisi !== null && (u.komisi as unknown as string) !== "" ? Number(u.komisi) : undefined,
      barcode: u.barcode || undefined,
      isDefault: Boolean(u.isDefault),
    };
  });
}

function normalizeStokLokasi(rawStokLokasi: unknown): BarangStokLokasi[] {
  if (!Array.isArray(rawStokLokasi)) return [];
  return rawStokLokasi.map((raw) => {
    const s = raw as Partial<BarangStokLokasi>;
    if (!s.satuan || !s.lokasi) throw new ApiError(400, "Setiap baris stok awal harus memiliki satuan dan lokasi");
    return {
      satuan: s.satuan,
      lokasi: s.lokasi,
      rak: s.rak || undefined,
      jumlah: Number(s.jumlah) || 0,
      stokMinimum: s.stokMinimum !== undefined && s.stokMinimum !== null && (s.stokMinimum as unknown as string) !== "" ? Number(s.stokMinimum) : undefined,
      stokMaksimum: s.stokMaksimum !== undefined && s.stokMaksimum !== null && (s.stokMaksimum as unknown as string) !== "" ? Number(s.stokMaksimum) : undefined,
    };
  });
}

export const barangController = {
  async list(req: Request, res: Response) {
    const { search, kategori } = req.query;
    let items = await store.findAll();

    if (typeof search === "string" && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((b) => b.kode.toLowerCase().includes(q) || b.nama.toLowerCase().includes(q));
    }
    if (typeof kategori === "string" && kategori) {
      items = items.filter((b) => b.kategori === kategori);
    }

    const { page, limit } = parsePagination(req);
    res.json(paginate(items, page, limit));
  },

  async get(req: Request, res: Response) {
    const item = await store.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "Barang tidak ditemukan");
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const {
      kode,
      nama,
      kategori,
      jenis,
      grup,
      deskripsi,
      brand,
      model,
      supplierId,
      units,
      stokLokasi,
      tampilBooking,
      aktif,
    } = req.body;
    if (!kode || !nama || !kategori) {
      throw new ApiError(400, "kode, nama, dan kategori wajib diisi");
    }

    const normalizedUnits = normalizeUnits(units);
    const defaultUnit = normalizedUnits.find((u) => u.isDefault) ?? normalizedUnits[0];
    const normalizedStokLokasi = normalizeStokLokasi(stokLokasi);
    const totalStok = normalizedStokLokasi.reduce((sum, s) => sum + s.jumlah, 0);

    const item = await store.create({
      kode,
      nama,
      kategori,
      jenis: jenis || undefined,
      grup: grup || undefined,
      deskripsi,
      brand,
      model: model || undefined,
      supplierId: supplierId || undefined,
      satuan: defaultUnit.satuan,
      units: normalizedUnits,
      hargaBeli: defaultUnit.hargaBeli,
      hargaJual: defaultUnit.hargaJual,
      stok: totalStok,
      stokLokasi: normalizedStokLokasi,
      tampilBooking: Boolean(tampilBooking),
      aktif: aktif === undefined ? true : Boolean(aktif),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const { units, ...rest } = req.body;
    // satuan/hargaBeli/hargaJual are denormalized copies of the default unit (see create)
    // that the list, paket pricing, and invoices read -- re-derive them whenever units
    // change, or edited prices never show up anywhere outside the unit table.
    let unitPatch = {};
    if (units !== undefined) {
      const normalizedUnits = normalizeUnits(units);
      const defaultUnit = normalizedUnits.find((u) => u.isDefault) ?? normalizedUnits[0];
      unitPatch = {
        units: normalizedUnits,
        satuan: defaultUnit.satuan,
        hargaBeli: defaultUnit.hargaBeli,
        hargaJual: defaultUnit.hargaJual,
      };
    }
    const item = await store.update(String(req.params.id), { ...rest, ...unitPatch });
    if (!item) throw new ApiError(404, "Barang tidak ditemukan");
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const deleted = await store.delete(String(req.params.id));
    if (!deleted) throw new ApiError(404, "Barang tidak ditemukan");
    res.status(204).send();
  },

  template(_req: Request, res: Response) {
    const buffer = buildTemplateWorkbook("Items", TEMPLATE_HEADERS, TEMPLATE_INSTRUCTIONS);
    sendXlsx(res, buffer, "template-barang.xlsx");
  },

  async exportXlsx(_req: Request, res: Response) {
    const all = await store.findAll();
    const rows = await Promise.all(
      all.map(async (b) => [
        b.kode,
        b.nama,
        b.kategori,
        b.jenis ?? "",
        b.grup ?? "",
        b.brand ?? "",
        b.model ?? "",
        (await supplierStore.findById(b.supplierId ?? ""))?.nama ?? "",
        b.satuan,
        b.hargaBeli,
        b.hargaJual,
        b.stok,
        b.deskripsi ?? "",
        b.tampilBooking ? "Ya" : "Tidak",
        b.aktif ? "Ya" : "Tidak",
      ])
    );
    const buffer = buildExportWorkbook("Items", TEMPLATE_HEADERS, rows);
    sendXlsx(res, buffer, "data-barang.xlsx");
  },

  async importXlsx(req: Request, res: Response) {
    if (!req.file) throw new ApiError(400, "File tidak ditemukan");

    const rows = parseSheetRows(req.file.buffer, "Items");
    const barangByKode = new Map((await store.findAll()).map((b) => [b.kode.toLowerCase(), b]));
    const summary: ImportSummary = { created: 0, updated: 0, failed: 0, errors: [] };

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 3; // header + instruction row precede data
      try {
        const kode = row["Kode"];
        const nama = row["Nama"];
        const kategori = row["Kategori"];
        const satuanRaw = (row["Unit"] || "").toUpperCase();

        if (!kode || !nama || !kategori) {
          throw new Error("Kode, Nama, dan Kategori wajib diisi");
        }
        const existing = barangByKode.get(kode.toLowerCase());
        if (!SATUAN_OPTIONS.includes(satuanRaw as Satuan)) {
          throw new Error(`Unit harus salah satu dari: ${SATUAN_OPTIONS.join(", ")}`);
        }

        const kategoriNama = await ensureLookup("kategori", kategori);
        const jenisNama = row["Jenis"] ? await ensureLookup("jenis", row["Jenis"]) : undefined;
        const grupNama = row["Grup"] ? await ensureLookup("grup", row["Grup"]) : undefined;
        const brandNama = row["Brand"] ? await ensureLookup("brand", row["Brand"]) : undefined;
        const modelNama = row["Model"] ? await ensureLookup("model", row["Model"]) : undefined;
        const supplier = row["Supplier"] ? await ensureSupplier(row["Supplier"]) : undefined;

        const hargaBeli = Number(row["Harga Beli"]) || 0;
        const hargaJual = Number(row["Harga Jual"]) || 0;
        const stokAwal = Number(row["Stok Awal"]) || 0;
        const satuan = satuanRaw as Satuan;

        const unit: BarangUnit = { satuan, hargaBeli, hargaJual, conversionFactor: 1, isDefault: true };
        const stokLokasi: BarangStokLokasi[] =
          stokAwal > 0 ? [{ satuan, lokasi: "Toko", jumlah: stokAwal }] : [];

        const barangData = {
          kode,
          nama,
          kategori: kategoriNama,
          jenis: jenisNama,
          grup: grupNama,
          brand: brandNama,
          model: modelNama,
          supplierId: supplier?.id,
          deskripsi: row["Deskripsi"] || undefined,
          satuan,
          units: [unit],
          hargaBeli,
          hargaJual,
          stok: stokAwal,
          stokLokasi,
          tampilBooking: (row["Tampil di Booking (Ya/Tidak)"] || "").toLowerCase() === "ya",
          aktif: (row["Aktif (Ya/Tidak)"] || "").toLowerCase() !== "tidak",
        };

        if (existing) {
          const updated = (await store.update(existing.id, barangData))!;
          barangByKode.set(kode.toLowerCase(), updated);
          summary.updated = (summary.updated ?? 0) + 1;
        } else {
          const created = await store.create({ ...barangData, createdAt: new Date().toISOString() });
          barangByKode.set(kode.toLowerCase(), created);
          summary.created += 1;
        }
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({ row: rowNumber, message: err instanceof Error ? err.message : "Baris tidak valid" });
      }
    }

    if (hasSheet(req.file.buffer, "Services")) {
      const jasaRows = parseSheetRows(req.file.buffer, "Services");
      const jasaSummary = await importJasaRows(jasaRows);
      summary.created += jasaSummary.created;
      summary.updated = (summary.updated ?? 0) + (jasaSummary.updated ?? 0);
      summary.failed += jasaSummary.failed;
      summary.errors.push(...jasaSummary.errors.map((e) => ({ row: e.row, message: `[Jasa] ${e.message}` })));
    }

    res.json(summary);
  },

  // One-time fix-up: the business currently runs out of a single physical location, but
  // several stock-moving flows (and a handful of manual production fixes) never wrote a
  // matching stokLokasi entry, leaving barang.stok (the flat total) ahead of what
  // stokLokasi sums to. This tops up "GMI Harapan Indah" by the shortfall so the Stok per
  // Lokasi report reflects reality, without touching barang whose stokLokasi is already
  // correct (including ones legitimately spread across other locations).
  async reconcileStokLokasiPreview(_req: Request, res: Response) {
    const all = await store.findAll();
    const items = all
      .map((b) => {
        const stokLokasiSum = b.stokLokasi.reduce((s, sl) => s + sl.jumlah, 0);
        return { id: b.id, kode: b.kode, nama: b.nama, stok: b.stok, stokLokasiSum, selisih: b.stok - stokLokasiSum };
      })
      .filter((b) => b.selisih !== 0)
      .sort((a, b) => a.kode.localeCompare(b.kode));
    res.json({ count: items.length, items });
  },

  async reconcileStokLokasi(_req: Request, res: Response) {
    const TARGET_LOKASI = "GMI Harapan Indah";
    const all = await store.findAll();
    const fixed: { kode: string; nama: string; selisih: number }[] = [];

    for (const b of all) {
      const stokLokasiSum = b.stokLokasi.reduce((s, sl) => s + sl.jumlah, 0);
      const selisih = b.stok - stokLokasiSum;
      if (selisih === 0) continue;

      await store.updateWithLock(b.id, (current) => {
        const idx = current.stokLokasi.findIndex((sl) => sl.lokasi === TARGET_LOKASI && sl.satuan === current.satuan);
        const stokLokasi =
          idx === -1
            ? [...current.stokLokasi, { satuan: current.satuan, lokasi: TARGET_LOKASI, jumlah: Math.max(0, selisih) }]
            : current.stokLokasi.map((sl, i) => (i === idx ? { ...sl, jumlah: Math.max(0, sl.jumlah + selisih) } : sl));
        return { stokLokasi };
      });
      fixed.push({ kode: b.kode, nama: b.nama, selisih });
    }

    res.json({ fixed: fixed.length, items: fixed });
  },

  async orphanedItemsPreview(_req: Request, res: Response) {
    const orphaned = await findOrphanedBarang();
    res.json({ count: orphaned.length, items: orphaned });
  },

  // Re-creates each orphaned barang AT ITS ORIGINAL ID (raw insert, bypassing store.create()'s
  // random-id generation) so every historical Pembelian/Invoice/etc. that still references that
  // itemId resolves correctly again, instead of minting a disconnected new record.
  async restoreOrphanedItems(_req: Request, res: Response) {
    const orphaned = await findOrphanedBarang();
    const restored: { kode: string; nama: string; stok: number }[] = [];

    for (const o of orphaned) {
      const barang: Barang = {
        id: o.itemId,
        kode: o.kode,
        nama: o.nama,
        kategori: "Lainnya",
        satuan: o.satuan,
        units: [{ satuan: o.satuan, hargaBeli: o.hargaBeli, hargaJual: o.hargaBeli, conversionFactor: 1, isDefault: true }],
        hargaBeli: o.hargaBeli,
        hargaJual: o.hargaBeli,
        stok: o.stok,
        stokLokasi: o.stok > 0 ? [{ satuan: o.satuan, lokasi: TARGET_LOKASI, jumlah: o.stok }] : [],
        tampilBooking: false,
        aktif: true,
        createdAt: new Date().toISOString(),
      };
      await pool.query(`INSERT INTO \`barang\` (id, data) VALUES (?, ?)`, [barang.id, JSON.stringify(barang)]);
      restored.push({ kode: o.kode, nama: o.nama, stok: o.stok });
    }

    res.json({ restored: restored.length, items: restored });
  },

  // Read-only audit trail: every stock-affecting event ever recorded against this barang,
  // across every flow that touches barang.stok, so a "why is this at 0" question can be
  // answered by reading the actual history instead of guessing at it.
  async riwayatStok(req: Request, res: Response) {
    const id = String(req.params.id);
    const barang = await store.findById(id);
    if (!barang) throw new ApiError(404, "Barang tidak ditemukan");

    const [pembelianAll, returPembelianAll, invoiceAll, returAll, penerimaanAll, pengeluaranAll, stokOpnameAll] = await Promise.all([
      rawFindAll<{ kode: string; tanggal: string; items: PembelianItem[] }>("pembelian"),
      rawFindAll<{ kode: string; tanggal: string; items: { itemId: string; qty: number }[] }>("retur_pembelian"),
      rawFindAll<Invoice>("invoice"),
      rawFindAll<{ kode: string; tanggal: string; items: { itemId: string; qty: number }[] }>("retur"),
      rawFindAll<{ kode: string; tanggal: string; status: string; items: { itemId: string; jumlah: number; lokasi: string; satuan: string }[] }>(
        "penerimaan_barang"
      ),
      rawFindAll<{ kode: string; tanggal: string; status: string; items: { itemId: string; jumlah: number; lokasi: string }[] }>(
        "pengeluaran_barang"
      ),
      rawFindAll<StokOpname>("stok_opname"),
    ]);

    interface StokEvent {
      tanggal: string;
      tipe: string;
      kode: string;
      perubahan: number;
      keterangan: string;
    }
    const events: StokEvent[] = [];

    pembelianAll.forEach((p) =>
      p.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({ tanggal: p.tanggal, tipe: "Pembelian", kode: p.kode, perubahan: it.qty, keterangan: `di ${it.lokasi ?? "-"}` });
      })
    );
    returPembelianAll.forEach((r) =>
      r.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({ tanggal: r.tanggal, tipe: "Retur Pembelian", kode: r.kode, perubahan: -it.qty, keterangan: "" });
      })
    );
    invoiceAll.forEach((inv) =>
      inv.items.forEach((it) => {
        if (it.itemId !== id || it.tipe !== "barang") return;
        events.push({ tanggal: inv.tanggal, tipe: "Penjualan", kode: inv.kode, perubahan: -it.qty, keterangan: `di ${it.lokasi ?? "-"}` });
      })
    );
    returAll.forEach((r) =>
      r.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({ tanggal: r.tanggal, tipe: "Retur Penjualan", kode: r.kode, perubahan: it.qty, keterangan: "" });
      })
    );
    penerimaanAll.forEach((pb) => {
      if (pb.status !== "terposting") return;
      pb.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({ tanggal: pb.tanggal, tipe: "Penerimaan Barang", kode: pb.kode, perubahan: it.jumlah, keterangan: `di ${it.lokasi}` });
      });
    });
    pengeluaranAll.forEach((pg) => {
      if (pg.status !== "terposting") return;
      pg.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({ tanggal: pg.tanggal, tipe: "Pengeluaran Barang", kode: pg.kode, perubahan: -it.jumlah, keterangan: `di ${it.lokasi}` });
      });
    });
    stokOpnameAll.forEach((so) =>
      so.items.forEach((it) => {
        if (it.itemId !== id) return;
        events.push({
          tanggal: so.tanggal,
          tipe: "Stok Opname",
          kode: so.kode,
          perubahan: it.selisih,
          keterangan: `Sistem ${it.stokSistem} -> Fisik ${it.stokFisik} di ${so.lokasi}`,
        });
      })
    );

    events.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    res.json({
      barang: { id: barang.id, kode: barang.kode, nama: barang.nama, stok: barang.stok, stokLokasi: barang.stokLokasi },
      events,
    });
  },
};
