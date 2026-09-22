export type StatusPelanggan = "aktif" | "nonaktif";

export interface Pelanggan {
  id: string;
  kode: string;
  nama: string;
  tipe?: string;
  telepon: string;
  email: string;
  npwp?: string;
  nik?: string;
  tanggalLahir?: string;
  kota: string;
  syaratPembayaran?: string;
  alamat: string;
  alamatPengiriman?: string;
  alamatPenagihan?: string;
  namaPIC?: string;
  kontakPIC?: string;
  plafonKredit?: number;
  saldoKredit?: number;
  status: StatusPelanggan;
  createdAt: string;
}

export type StatusSupplier = "aktif" | "nonaktif";

export const SYARAT_PEMBAYARAN_OPTIONS = ["Cash", "NET 7", "NET 14", "NET 30", "NET 60"] as const;

export interface Supplier {
  id: string;
  kode: string;
  nama: string;
  tipe: string;
  telepon: string;
  email: string;
  npwp?: string;
  nik?: string;
  kota: string;
  syaratPembayaran?: string;
  alamat: string;
  alamatPengiriman?: string;
  alamatPenagihan?: string;
  namaPIC?: string;
  kontakPIC?: string;
  saldoKredit?: number;
  status: StatusSupplier;
  createdAt: string;
}

export interface Kendaraan {
  id: string;
  pelangganId: string;
  tipe: string;
  platNomor: string;
  merk: string;
  model: string;
  tahun: number;
  warna?: string;
  createdAt: string;
}

export interface Mekanik {
  id: string;
  nama: string;
  spesialisasi?: string;
  createdAt: string;
}

export const SATUAN_OPTIONS = ["PCS", "SET", "BOX", "DUS", "METER", "KG", "UNIT", "JASA"] as const;
export type Satuan = (typeof SATUAN_OPTIONS)[number];

export interface BarangUnit {
  satuan: Satuan;
  hargaBeli: number;
  hargaJual: number;
  conversionFactor: number;
  komisi?: number;
  barcode?: string;
  isDefault: boolean;
}

export interface BarangStokLokasi {
  satuan: Satuan;
  lokasi: string;
  rak?: string;
  jumlah: number;
  stokMinimum?: number;
  stokMaksimum?: number;
}

export interface Barang {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  jenis?: string;
  grup?: string;
  deskripsi?: string;
  brand?: string;
  model?: string;
  supplierId?: string;
  satuan: Satuan;
  units: BarangUnit[];
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  stokLokasi: BarangStokLokasi[];
  tampilBooking: boolean;
  aktif: boolean;
  createdAt: string;
}

export interface Jasa {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  jenis: string;
  model?: string;
  deskripsi?: string;
  harga: number;
  komisi: number;
  tampilBooking: boolean;
  aktif: boolean;
  createdAt: string;
}

export type PaketItemTipe = "barang" | "jasa";

export interface PaketItem {
  tipe: PaketItemTipe;
  itemId: string;
  satuan?: string;
  qty: number;
  diskonTipe?: "persen" | "rupiah";
  diskonPersen: number;
  diskonRp?: number;
}

export interface Paket {
  id: string;
  kode: string;
  nama: string;
  deskripsi?: string;
  items: PaketItem[];
  aktif: boolean;
  tampilBooking: boolean;
  createdAt: string;
}

export type StatusServis = "antrian" | "dikerjakan" | "menunggu_sparepart" | "selesai" | "dibatalkan";

export interface ItemServis {
  nama: string;
  qty: number;
  hargaSatuan: number;
}

export interface Servis {
  id: string;
  kendaraanId: string;
  mekanikId?: string;
  keluhan: string;
  status: StatusServis;
  items: ItemServis[];
  estimasiSelesai?: string;
  createdAt: string;
  updatedAt: string;
}

export type StatusInvoice = "selesai" | "draft" | "dibatalkan";
export type StatusPembayaran = "lunas" | "belum_dibayar" | "dibayar_setengah";

export interface InvoiceItem {
  tipe: PaketItemTipe;
  itemId: string;
  nama: string;
  kode?: string;
  satuan?: string;
  qty: number;
  hargaSatuan: number;
  diskonTipe?: "persen" | "rupiah";
  diskonPersen: number;
  diskonRp?: number;
  lokasi?: string;
}

export interface Invoice {
  id: string;
  kode: string;
  pelangganId: string;
  kendaraanIds?: string[];
  kilometer?: number;
  tanggal: string;
  jatuhTempo?: string;
  syaratPembayaran?: string;
  catatan?: string;
  keluhan?: string;
  items: InvoiceItem[];
  potonganPersen?: number;
  subtotal?: number;
  dpp?: number;
  pajakPersen?: number;
  pajak?: number;
  total: number;
  dibayar: number;
  returTotal?: number;
  status: StatusInvoice;
  statusPembayaran: StatusPembayaran;
  createdAt: string;
}

export interface Pembayaran {
  id: string;
  invoiceId: string;
  tanggal: string;
  jumlah: number;
  metode?: string;
  createdAt: string;
}

export interface ReturItem {
  itemId: string;
  nama: string;
  qty: number;
  hargaSatuan: number;
}

export type StatusRetur = "draft" | "ongoing" | "selesai";

export interface Retur {
  id: string;
  kode: string;
  invoiceId: string;
  tanggal: string;
  alasan?: string;
  items: ReturItem[];
  subtotal: number;
  potonganPersen?: number;
  potonganRp?: number;
  pajakPersen?: number;
  pajak?: number;
  total: number;
  status: StatusRetur;
  createdAt: string;
}

export type StatusPemasukan = "selesai" | "dibatalkan";

export interface PemasukanLain {
  id: string;
  kategori: string;
  deskripsi?: string;
  tanggal: string;
  jumlah: number;
  status: StatusPemasukan;
  createdAt: string;
}

export interface Posisi {
  id: string;
  kode: string;
  nama: string;
  deskripsi?: string;
  aktif: boolean;
  dapatDitugaskanServis: boolean;
  createdAt: string;
}

export type TipeLokasi = "toko" | "gudang" | "cabang";
export type StatusLokasi = "aktif" | "nonaktif";

export interface Lokasi {
  id: string;
  nama: string;
  tipe: TipeLokasi;
  alamat: string;
  kota: string;
  telepon: string;
  status: StatusLokasi;
  createdAt: string;
}

export type SatuanGaji = "per_bulan" | "per_minggu" | "per_hari" | "per_jam";
export type StatusKaryawan = "aktif" | "nonaktif";

export interface Karyawan {
  id: string;
  kode: string;
  nama: string;
  email?: string;
  telepon?: string;
  nik?: string;
  alamat?: string;
  posisiId?: string;
  tanggalMasuk: string;
  satuanGaji: SatuanGaji;
  gaji: number;
  status: StatusKaryawan;
  createdAt: string;
}

export type TipeGajiFilter = "semua" | "per_minggu" | "per_bulan" | "per_hari" | "per_jam";

export interface PeriodeGajiRow {
  karyawanId: string;
  namaKaryawan: string;
  posisiNama?: string;
  satuanGaji: SatuanGaji;
  gajiPokok: number;
  komisi: number;
  potongan: number;
  totalTerima: number;
}

export interface PeriodeGaji {
  id: string;
  nama: string;
  catatan?: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  tipe: TipeGajiFilter;
  rows: PeriodeGajiRow[];
  totalGaji: number;
  totalKomisi: number;
  totalPotongan: number;
  totalKeseluruhan: number;
  createdAt: string;
}

export type StatusPembelian = "selesai" | "draft" | "dibatalkan";

export interface PembelianItem {
  itemId: string;
  nama: string;
  kode?: string;
  satuan?: string;
  qty: number;
  hargaSatuan: number;
  diskonTipe?: "persen" | "rupiah";
  diskonPersen: number;
  diskonRp?: number;
  lokasi?: string;
}

export interface Pembelian {
  id: string;
  kode: string;
  supplierId: string;
  tanggal: string;
  jatuhTempo?: string;
  syaratPembayaran?: string;
  noInvoiceSupplier?: string;
  catatan?: string;
  metodePembayaran?: string;
  catatanPembayaran?: string;
  items: PembelianItem[];
  potonganPersen?: number;
  subtotal?: number;
  dpp?: number;
  bebasPpn?: boolean;
  pajakPersen?: number;
  pajak?: number;
  biayaPengiriman?: number;
  biayaLainnya?: number;
  total: number;
  dibayar: number;
  returTotal?: number;
  status: StatusPembelian;
  statusPembayaran: StatusPembayaran;
  createdAt: string;
}

export interface StokOpnameItem {
  itemId: string;
  nama: string;
  kode: string;
  satuan: string;
  stokSistem: number;
  stokFisik: number;
  selisih: number;
}

export interface StokOpname {
  id: string;
  kode: string;
  tanggal: string;
  lokasi: string;
  items: StokOpnameItem[];
  totalSelisihItem: number;
  catatan?: string;
  createdAt: string;
}

export type StatusPenerimaanBarang = "draft" | "terposting";

export interface PenerimaanBarangItem {
  itemId: string;
  nama: string;
  kode: string;
  satuan: string;
  lokasi: string;
  jumlah: number;
  hargaSatuan?: number;
  catatan?: string;
}

export interface PenerimaanBarang {
  id: string;
  kode: string;
  tanggal: string;
  alasan: string;
  catatan?: string;
  items: PenerimaanBarangItem[];
  status: StatusPenerimaanBarang;
  dibuatOleh?: string;
  postedAt?: string;
  createdAt: string;
}

export type StatusPengeluaranBarang = "draft" | "terposting";

export interface PengeluaranBarangItem {
  itemId: string;
  nama: string;
  kode: string;
  satuan: string;
  lokasi: string;
  jumlah: number;
  hargaSatuan?: number;
  catatan?: string;
}

export interface PengeluaranBarang {
  id: string;
  kode: string;
  tanggal: string;
  alasan: string;
  catatan?: string;
  items: PengeluaranBarangItem[];
  status: StatusPengeluaranBarang;
  dibuatOleh?: string;
  postedAt?: string;
  createdAt: string;
}

export interface ReturPembelianItem {
  itemId: string;
  nama: string;
  qty: number;
  hargaSatuan: number;
}

export interface ReturPembelian {
  id: string;
  kode: string;
  pembelianId: string;
  tanggal: string;
  alasan?: string;
  items: ReturPembelianItem[];
  total: number;
  createdAt: string;
}

export interface PembayaranHutang {
  id: string;
  pembelianId: string;
  tanggal: string;
  jumlah: number;
  metode?: string;
  createdAt: string;
}

export type StatusPengeluaran = "selesai" | "dibatalkan";

export interface PengeluaranLain {
  id: string;
  kategori: string;
  deskripsi?: string;
  tanggal: string;
  jumlah: number;
  status: StatusPengeluaran;
  createdAt: string;
}

export const LOOKUP_TIPE_OPTIONS = [
  "kategori",
  "brand",
  "unit",
  "jenis",
  "grup",
  "model",
  "tipe-pembayaran",
  "syarat-pembayaran",
  "kategori-pemasukan",
  "kategori-pengeluaran",
  "tipe-pelanggan",
  "tipe-supplier",
  "tipe-kendaraan",
  "brand-kendaraan",
  "model-kendaraan",
  "alasan-retur",
] as const;
export type LookupTipe = (typeof LOOKUP_TIPE_OPTIONS)[number];

export interface Lookup {
  id: string;
  tipe: LookupTipe;
  nama: string;
  deskripsi?: string;
  jatuhTempoHari?: number;
  createdAt: string;
}

export interface PajakSetting {
  aktif: boolean;
  persentase: number;
  pembulatan: number;
}

export interface CompanyProfile {
  namaPerusahaan: string;
  alamat: string;
  telepon: string;
  email: string;
  bankNama: string;
  bankNoRekening: string;
  bankAtasNama: string;
}

export const USER_ROLE_OPTIONS = ["superadmin", "admin", "staff"] as const;
export type UserRole = (typeof USER_ROLE_OPTIONS)[number];

export interface User {
  id: string;
  nama: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  aktif: boolean;
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;
