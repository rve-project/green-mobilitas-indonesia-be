// Seeds the in-memory API with realistic, cross-linked demo data.
// Usage: node scripts/seed.mjs   (run while `npm run dev` is already up)
const API_URL = process.env.API_URL ?? "http://localhost:4000/api";
const SUPERADMIN_EMAIL = process.env.SEED_EMAIL ?? "superadmin@bengkelku.com";
const SUPERADMIN_PASSWORD = process.env.SEED_PASSWORD ?? "SuperAdmin123!";

let authToken = null;

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login gagal -> ${res.status} ${text}`);
  }
  const data = await res.json();
  authToken = data.token;
}

async function api(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const post = (path, body) => api("POST", path, body);

function barangPayload({ kode, nama, kategori, brand, satuan, hargaBeli, hargaJual, stok, tampilBooking }) {
  return {
    kode,
    nama,
    kategori,
    brand,
    tampilBooking,
    units: [
      { satuan, hargaBeli, hargaJual, conversionFactor: 1, isDefault: true },
    ],
    stokLokasi: stok
      ? [{ satuan, lokasi: "Gudang Utama", jumlah: stok }]
      : [],
  };
}

async function main() {
  console.log("Logging in as superadmin...");
  await login();

  console.log("Seeding lokasi...");
  await post("/lokasi", {
    nama: "Gudang Utama",
    tipe: "gudang",
    alamat: "Jl. Industri Raya No. 1, Jakarta",
    kota: "Jakarta",
    telepon: "021-5550001",
  });
  await post("/lokasi", {
    nama: "Toko Depan",
    tipe: "toko",
    alamat: "Jl. Raya Bengkel No. 10, Jakarta",
    kota: "Jakarta",
    telepon: "021-5550002",
  });

  console.log("Seeding posisi...");
  const posKepala = await post("/posisi", { nama: "Kepala Bengkel", deskripsi: "Memimpin operasional bengkel" });
  const posMekanik = await post("/posisi", { nama: "Mekanik", deskripsi: "Menangani servis dan perbaikan kendaraan" });
  const posAdmin = await post("/posisi", { nama: "Admin/Kasir", deskripsi: "Menangani transaksi dan administrasi" });

  console.log("Seeding karyawan...");
  const karHelmy = await post("/karyawan", {
    nama: "Helmy",
    email: "helmy@bengkelku.com",
    telepon: "081234500001",
    posisiId: posKepala.id,
    tanggalMasuk: "2024-01-15",
    satuanGaji: "per_bulan",
    gaji: 6000000,
  });
  const karBudi = await post("/karyawan", {
    nama: "Budi Santoso",
    email: "budi.santoso@bengkelku.com",
    telepon: "081234500002",
    posisiId: posMekanik.id,
    tanggalMasuk: "2024-03-01",
    satuanGaji: "per_bulan",
    gaji: 4000000,
  });
  const karSiti = await post("/karyawan", {
    nama: "Siti Aminah",
    email: "siti.aminah@bengkelku.com",
    telepon: "081234500003",
    posisiId: posAdmin.id,
    tanggalMasuk: "2024-06-10",
    satuanGaji: "per_bulan",
    gaji: 3500000,
  });

  console.log("Seeding mekanik...");
  const mekBudi = await post("/mekanik", { nama: "Budi Santoso", spesialisasi: "Mesin & Kelistrikan" });
  const mekJoko = await post("/mekanik", { nama: "Joko Prasetyo", spesialisasi: "Ban & Body" });

  console.log("Seeding pelanggan...");
  const plgSatuTujuh = await post("/pelanggan", {
    nama: "PT. Satu Kosong Tujuh",
    telepon: "021-89491763",
    email: "hrga@ptsatukosongtujuh.com",
    npwp: "01.234.567.8-901.000",
    kota: "Jakarta",
    syaratPembayaran: "NET 30",
    alamat: "Jl. Sudirman No. 45, Jakarta Selatan",
    namaPIC: "Muhammad Alif",
    kontakPIC: "081234567890",
    plafonKredit: 20000000,
  });
  const plgAndi = await post("/pelanggan", {
    nama: "Andi Wijaya",
    telepon: "081298765432",
    email: "andi.wijaya@gmail.com",
    nik: "3275010101900001",
    kota: "Bekasi",
    alamat: "Jl. Ahmad Yani No. 12, Bekasi",
  });
  const plgRina = await post("/pelanggan", {
    nama: "Rina Kusuma",
    telepon: "081345678901",
    email: "rina.kusuma@gmail.com",
    kota: "Tangerang",
    alamat: "Jl. Merdeka No. 8, Tangerang",
  });
  const plgMitra = await post("/pelanggan", {
    nama: "CV Mitra Otomotif",
    telepon: "022-70012345",
    email: "cs@mitraotomotif.co.id",
    npwp: "02.345.678.9-012.000",
    kota: "Bandung",
    syaratPembayaran: "NET 14",
    alamat: "Jl. Asia Afrika No. 88, Bandung",
    namaPIC: "Dewi Lestari",
    kontakPIC: "081376543210",
    plafonKredit: 15000000,
  });

  console.log("Seeding supplier...");
  const supSeiji = await post("/supplier", {
    nama: "Seiji Digital",
    tipe: "Distributor",
    telepon: "081200011122",
    email: "info@seijidigital.com",
    npwp: "03.456.789.0-123.000",
    kota: "Jakarta",
    syaratPembayaran: "NET 30",
    alamat: "Jl. Gatot Subroto No. 21, Jakarta",
    namaPIC: "Hendra Gunawan",
    kontakPIC: "081200011122",
  });
  const supCotama = await post("/supplier", {
    nama: "Cotama Stationery",
    tipe: "Grosir",
    telepon: "081200033344",
    email: "sales@cotama.co.id",
    kota: "Jakarta",
    syaratPembayaran: "NET 14",
    alamat: "Jl. Mangga Dua No. 5, Jakarta",
  });
  const supAtkMu = await post("/supplier", {
    nama: "ATK MU",
    tipe: "Retail",
    telepon: "081200055566",
    email: "atkmu@gmail.com",
    kota: "Bandung",
    alamat: "Jl. Kopo No. 100, Bandung",
  });

  console.log("Seeding kendaraan...");
  const kndAvanza = await post("/kendaraan", {
    pelangganId: plgSatuTujuh.id,
    tipe: "Mobil",
    platNomor: "B 1234 ABC",
    merk: "Toyota",
    model: "Avanza",
    tahun: 2022,
    warna: "Putih",
  });
  await post("/kendaraan", {
    pelangganId: plgSatuTujuh.id,
    tipe: "Mobil",
    platNomor: "B 5678 XYZ",
    merk: "Honda",
    model: "Brio",
    tahun: 2021,
    warna: "Hitam",
  });
  const kndVario = await post("/kendaraan", {
    pelangganId: plgAndi.id,
    tipe: "Motor",
    platNomor: "B 9101 ADW",
    merk: "Honda",
    model: "Vario 150",
    tahun: 2020,
    warna: "Merah",
  });
  const kndNmax = await post("/kendaraan", {
    pelangganId: plgRina.id,
    tipe: "Motor",
    platNomor: "D 2345 RIN",
    merk: "Yamaha",
    model: "NMAX",
    tahun: 2023,
    warna: "Biru",
  });
  await post("/kendaraan", {
    pelangganId: plgMitra.id,
    tipe: "Mobil",
    platNomor: "D 6789 MTO",
    merk: "Mitsubishi",
    model: "Pajero Sport",
    tahun: 2019,
    warna: "Hitam",
  });

  console.log("Seeding barang...");
  const brgOli = await post("/barang", barangPayload({
    kode: "ITEM-OLI-001",
    nama: "Oli Mesin 4T 1L",
    kategori: "Pelumas",
    brand: "Shell",
    satuan: "PCS",
    hargaBeli: 35000,
    hargaJual: 55000,
    stok: 50,
    tampilBooking: true,
  }));
  const brgBan = await post("/barang", barangPayload({
    kode: "ITEM-BAN-001",
    nama: "Ban Motor Tubeless 80/90-14",
    kategori: "Ban",
    brand: "FDR",
    satuan: "PCS",
    hargaBeli: 180000,
    hargaJual: 250000,
    stok: 20,
    tampilBooking: true,
  }));
  const brgAki = await post("/barang", barangPayload({
    kode: "ITEM-AKI-001",
    nama: "Aki Motor GTZ5S",
    kategori: "Aki",
    brand: "GS Astra",
    satuan: "PCS",
    hargaBeli: 150000,
    hargaJual: 220000,
    stok: 15,
    tampilBooking: true,
  }));
  const brgKampas = await post("/barang", barangPayload({
    kode: "ITEM-KAMPAS-001",
    nama: "Kampas Rem Depan",
    kategori: "Rem",
    brand: "Nissin",
    satuan: "PCS",
    hargaBeli: 45000,
    hargaJual: 75000,
    stok: 30,
    tampilBooking: true,
  }));
  const brgFilter = await post("/barang", barangPayload({
    kode: "ITEM-FILTER-001",
    nama: "Filter Udara",
    kategori: "Filter",
    brand: "Sakura",
    satuan: "PCS",
    hargaBeli: 25000,
    hargaJual: 45000,
    stok: 40,
    tampilBooking: true,
  }));
  const brgBusi = await post("/barang", barangPayload({
    kode: "ITEM-BUSI-001",
    nama: "Busi Motor",
    kategori: "Pengapian",
    brand: "NGK",
    satuan: "PCS",
    hargaBeli: 15000,
    hargaJual: 30000,
    stok: 60,
    tampilBooking: true,
  }));

  console.log("Seeding jasa...");
  const jasaServiceRingan = await post("/jasa", {
    kode: "JASA-SERVICE-001",
    nama: "Service Ringan",
    kategori: "Perawatan",
    jenis: "Motor",
    harga: 50000,
    komisi: 15,
  });
  const jasaServiceBesar = await post("/jasa", {
    kode: "JASA-SERVICE-002",
    nama: "Service Besar",
    kategori: "Perawatan",
    jenis: "Motor",
    harga: 150000,
    komisi: 20,
  });
  const jasaTambal = await post("/jasa", {
    kode: "JASA-TAMBAL-001",
    nama: "Tambal Ban",
    kategori: "Perbaikan",
    jenis: "Motor",
    harga: 20000,
    komisi: 10,
  });
  await post("/jasa", {
    kode: "JASA-CUCI-001",
    nama: "Cuci Motor",
    kategori: "Perawatan",
    jenis: "Motor",
    harga: 25000,
    komisi: 10,
  });

  console.log("Seeding paket...");
  await post("/paket", {
    nama: "Paket Service Lengkap",
    deskripsi: "Ganti oli + service ringan",
    items: [
      { tipe: "barang", itemId: brgOli.id, qty: 1, diskonPersen: 0 },
      { tipe: "jasa", itemId: jasaServiceRingan.id, qty: 1, diskonPersen: 0 },
    ],
  });

  console.log("Seeding servis...");
  const srv1 = await post("/servis", {
    kendaraanId: kndAvanza.id,
    mekanikId: mekBudi.id,
    keluhan: "Ganti oli rutin",
    items: [{ nama: "Oli Mesin 4T 1L", qty: 1, hargaSatuan: 55000 }],
  });
  await api("PUT", `/servis/${srv1.id}`, { status: "selesai" });

  const srv2 = await post("/servis", {
    kendaraanId: kndVario.id,
    mekanikId: mekJoko.id,
    keluhan: "Servis rutin + ganti kampas rem",
    items: [{ nama: "Kampas Rem Depan", qty: 1, hargaSatuan: 75000 }],
  });
  await api("PUT", `/servis/${srv2.id}`, { status: "dikerjakan" });

  await post("/servis", {
    kendaraanId: kndNmax.id,
    mekanikId: mekBudi.id,
    keluhan: "Ban belakang bocor halus",
  });

  console.log("Seeding invoice (penjualan)...");
  const inv1 = await post("/invoice", {
    pelangganId: plgSatuTujuh.id,
    kendaraanId: kndAvanza.id,
    items: [
      { tipe: "barang", itemId: brgOli.id, qty: 2, diskonPersen: 0 },
      { tipe: "jasa", itemId: jasaServiceRingan.id, qty: 1, diskonPersen: 0 },
    ],
    dibayar: 160000,
  });
  const inv2 = await post("/invoice", {
    pelangganId: plgAndi.id,
    kendaraanId: kndVario.id,
    items: [
      { tipe: "barang", itemId: brgKampas.id, qty: 1, diskonPersen: 0 },
      { tipe: "jasa", itemId: jasaServiceBesar.id, qty: 1, diskonPersen: 0 },
    ],
    dibayar: 100000,
  });
  const inv3 = await post("/invoice", {
    pelangganId: plgRina.id,
    kendaraanId: kndNmax.id,
    items: [{ tipe: "jasa", itemId: jasaTambal.id, qty: 1, diskonPersen: 0 }],
    dibayar: 0,
  });
  await post("/invoice", {
    pelangganId: plgMitra.id,
    items: [
      { tipe: "barang", itemId: brgAki.id, qty: 1, diskonPersen: 0 },
      { tipe: "barang", itemId: brgFilter.id, qty: 2, diskonPersen: 5 },
    ],
    dibayar: 305500,
  });

  console.log("Seeding retur penjualan...");
  await post("/retur", {
    invoiceId: inv1.id,
    alasan: "Kemasan oli rusak",
    items: [{ itemId: brgOli.id, qty: 1 }],
  });

  console.log("Seeding pembayaran (pelunasan piutang)...");
  await post("/pembayaran", { invoiceId: inv3.id, jumlah: 10000, metode: "Tunai" });

  console.log("Seeding pemasukan lain...");
  await post("/pemasukan-lain", { kategori: "Penjualan Kardus", jumlah: 50000 });
  await post("/pemasukan-lain", { kategori: "Pendapatan Sewa Alat", jumlah: 200000 });

  console.log("Seeding pembelian...");
  const pb1 = await post("/pembelian", {
    supplierId: supSeiji.id,
    items: [
      { itemId: brgOli.id, qty: 50, diskonPersen: 0, lokasi: "Gudang Utama" },
      { itemId: brgFilter.id, qty: 40, diskonPersen: 0, lokasi: "Gudang Utama" },
    ],
    dibayar: 2750000,
  });
  const pb2 = await post("/pembelian", {
    supplierId: supCotama.id,
    items: [{ itemId: brgKampas.id, qty: 30, diskonPersen: 0, lokasi: "Gudang Utama" }],
    dibayar: 700000,
  });
  const pb3 = await post("/pembelian", {
    supplierId: supAtkMu.id,
    items: [
      { itemId: brgBusi.id, qty: 60, diskonPersen: 0, lokasi: "Gudang Utama" },
      { itemId: brgAki.id, qty: 15, diskonPersen: 0, lokasi: "Gudang Utama" },
    ],
    dibayar: 0,
  });

  console.log("Seeding retur pembelian...");
  await post("/retur-pembelian", {
    pembelianId: pb1.id,
    alasan: "Barang rusak saat pengiriman",
    items: [{ itemId: brgOli.id, qty: 5 }],
  });

  console.log("Seeding pembayaran hutang...");
  await post("/pembayaran-hutang", { pembelianId: pb3.id, jumlah: 900000, metode: "Transfer" });
  void pb2;

  console.log("Seeding pengeluaran lain...");
  await post("/pengeluaran-lain", { kategori: "Biaya Angkut", jumlah: 100000 });
  await post("/pengeluaran-lain", { kategori: "Sewa Gudang", jumlah: 500000 });

  console.log("Seeding periode gaji...");
  await post("/periode-gaji", {
    nama: "Periode 1 Agustus 2026 - 31 Agustus 2026",
    tanggalMulai: "2026-08-01",
    tanggalSelesai: "2026-08-31",
    tipe: "semua",
    rows: [
      {
        karyawanId: karHelmy.id,
        namaKaryawan: karHelmy.nama,
        posisiNama: posKepala.nama,
        satuanGaji: karHelmy.satuanGaji,
        gajiPokok: karHelmy.gaji,
        komisi: 0,
        potongan: 0,
        totalTerima: karHelmy.gaji,
      },
      {
        karyawanId: karBudi.id,
        namaKaryawan: karBudi.nama,
        posisiNama: posMekanik.nama,
        satuanGaji: karBudi.satuanGaji,
        gajiPokok: karBudi.gaji,
        komisi: 250000,
        potongan: 0,
        totalTerima: karBudi.gaji + 250000,
      },
      {
        karyawanId: karSiti.id,
        namaKaryawan: karSiti.nama,
        posisiNama: posAdmin.nama,
        satuanGaji: karSiti.satuanGaji,
        gajiPokok: karSiti.gaji,
        komisi: 0,
        potongan: 100000,
        totalTerima: karSiti.gaji - 100000,
      },
    ],
    totalGaji: karHelmy.gaji + karBudi.gaji + karSiti.gaji,
    totalKomisi: 250000,
    totalPotongan: 100000,
    totalKeseluruhan: karHelmy.gaji + karBudi.gaji + karSiti.gaji + 250000 - 100000,
  });

  console.log("Seeding pengaturan (lookup)...");
  const lookup = (tipe, nama, deskripsi, extra) =>
    post("/pengaturan/lookup", { tipe, nama, deskripsi, ...extra });

  for (const [nama, deskripsi] of [
    ["General Maintanance", "Auto-created from import"],
    ["TOOLS", "Auto-created from import"],
    ["LIQUIDS", "Auto-created from import"],
    ["Sistem Bahan Bakar (Fuel System)", "Auto-created from import"],
    ["Kelistrikan, Drivetrain & Lain-lain", "Auto-created from import"],
    ["Ban, Velg & Roda (Tires & Wheels)", "Auto-created from import"],
    ["Sistem Rem (Brake System)", "Auto-created from import"],
  ]) {
    await lookup("kategori", nama, deskripsi);
  }

  for (const nama of ["Shell", "Castrol", "FDR", "GS Astra", "Nissin", "Sakura", "NGK", "Honda", "Yamaha"]) {
    await lookup("brand", nama);
  }

  for (const nama of ["PCS", "SET", "BOX", "LITER", "METER"]) {
    await lookup("unit", nama);
  }

  for (const nama of ["Sparepart", "Oli & Pelumas", "Aksesoris", "Consumable"]) {
    await lookup("jenis", nama);
  }

  for (const nama of ["Fast Moving", "Slow Moving", "Musiman"]) {
    await lookup("grup", nama);
  }

  for (const nama of ["Standar", "Racing", "Original", "KW1"]) {
    await lookup("model", nama);
  }

  for (const [nama, deskripsi] of [
    ["Cash", "Pembayaran tunai langsung"],
    ["QRIS", "Quick Response Code Indonesia Standard - pembayaran instant via QR"],
    ["Debit Card", "Pembayaran menggunakan kartu debit"],
    ["Credit Card", "Pembayaran menggunakan kartu kredit"],
    ["Bank Transfer", "Pembayaran melalui transfer bank"],
  ]) {
    await lookup("tipe-pembayaran", nama, deskripsi);
  }

  for (const [nama, deskripsi, hari] of [
    ["COD", "Cash On Delivery - pembayaran tunai saat transaksi", 0],
    ["TOP 7", "Tempo Pembayaran 7 hari", 7],
    ["TOP 14", "Tempo Pembayaran 14 hari", 14],
    ["TOP 30", "Tempo Pembayaran 30 hari", 30],
    ["TOP 60", "Tempo Pembayaran 60 hari", 60],
  ]) {
    await lookup("syarat-pembayaran", nama, deskripsi, { jatuhTempoHari: hari });
  }

  for (const [nama, deskripsi] of [
    ["Penjualan Kardus", "Hasil penjualan kardus/kemasan bekas"],
    ["Pendapatan Sewa", "Pendapatan dari sewa alat atau ruang"],
    ["Komisi", "Pendapatan komisi dari pihak ketiga"],
  ]) {
    await lookup("kategori-pemasukan", nama, deskripsi);
  }

  for (const [nama, deskripsi] of [
    ["Beban Event Expense", null],
    ["Beban Pulsa", null],
    ["Beban Software License", null],
    ["Biaya Angkut", "Biaya pengiriman/pengangkutan barang"],
    ["Sewa Gudang", "Biaya sewa tempat penyimpanan"],
  ]) {
    await lookup("kategori-pengeluaran", nama, deskripsi);
  }

  for (const [nama, deskripsi] of [
    ["Grosir", "Pelanggan grosir / wholesale"],
    ["Semi Grosir", "Pelanggan semi grosir"],
    ["Retail", "Pelanggan retail / eceran"],
  ]) {
    await lookup("tipe-pelanggan", nama, deskripsi);
  }

  for (const [nama, deskripsi] of [
    ["Impor", "Supplier impor"],
    ["Lokal", "Supplier lokal"],
    ["Manufaktur", "Supplier manufaktur / pabrik"],
    ["Distributor", "Supplier distributor"],
    ["Grosir", "Supplier grosir / wholesale"],
  ]) {
    await lookup("tipe-supplier", nama, deskripsi);
  }

  for (const nama of ["Mobil Bensin", "Mobil Diesel", "Mobil Hybrid", "Mobil Listrik", "Motor Bebek", "Motor Matic", "Motor Sport", "Motor Listrik"]) {
    await lookup("tipe-kendaraan", nama);
  }

  for (const nama of ["Toyota", "Honda", "Suzuki", "Daihatsu", "Mitsubishi", "Yamaha", "Kawasaki", "BMW", "Mercedes-Benz"]) {
    await lookup("brand-kendaraan", nama);
  }

  for (const nama of ["Avanza", "Brio", "Vario 150", "NMAX", "Pajero Sport", "Xenia", "Beat", "PCX"]) {
    await lookup("model-kendaraan", nama);
  }

  console.log("Seeding pengaturan (pajak)...");
  await api("PUT", "/pengaturan/pajak", { aktif: true, persentase: 11, pembulatan: 0 });

  console.log("\nDone! All data seeded and cross-linked.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
