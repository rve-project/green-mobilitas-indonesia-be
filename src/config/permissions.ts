import { UserRole } from "../models/types";

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Beranda",
  "barang-jasa": "Barang & Jasa",
  penjualan: "Penjualan",
  pembelian: "Pembelian",
  "manajemen-stok": "Manajemen Stok",
  pelanggan: "Pelanggan",
  supplier: "Supplier",
  "manajemen-karyawan": "Manajemen Karyawan",
  laporan: "Laporan",
  pengaturan: "Pengaturan",
  "manajemen-user": "Manajemen User",
};

export const MODULE_KEYS = [
  "dashboard",
  "barang-jasa",
  "penjualan",
  "pembelian",
  "manajemen-stok",
  "pelanggan",
  "supplier",
  "manajemen-karyawan",
  "laporan",
  "pengaturan",
  "manajemen-user",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * Single source of truth for which roles can access which module.
 * Mirrored on the frontend at src/lib/permissions.ts — keep both in sync.
 */
export const MODULE_ROLES: Record<ModuleKey, UserRole[]> = {
  dashboard: ["superadmin", "admin", "staff"],
  "barang-jasa": ["superadmin", "admin", "staff"],
  penjualan: ["superadmin", "admin", "staff"],
  pembelian: ["superadmin", "admin", "staff"],
  "manajemen-stok": ["superadmin", "admin", "staff"],
  pelanggan: ["superadmin", "admin", "staff"],
  supplier: ["superadmin", "admin", "staff"],
  "manajemen-karyawan": ["superadmin", "admin"],
  laporan: ["superadmin", "admin"],
  pengaturan: ["superadmin", "admin"],
  "manajemen-user": ["superadmin"],
};

/**
 * Modules a user can actually reach: the role's default set, optionally narrowed by a
 * per-user `allowedModules` restriction (an admin can only take away access their role
 * would otherwise grant — never add access beyond the role ceiling).
 */
export function effectiveModules(role: UserRole, allowedModules?: string[] | null): ModuleKey[] {
  const roleModules = MODULE_KEYS.filter((m) => MODULE_ROLES[m].includes(role));
  if (!allowedModules) return roleModules;
  const allowedSet = new Set(allowedModules);
  return roleModules.filter((m) => allowedSet.has(m));
}

export function canAccessModule(user: { role: UserRole; allowedModules?: string[] | null }, module: ModuleKey): boolean {
  return effectiveModules(user.role, user.allowedModules).includes(module);
}
