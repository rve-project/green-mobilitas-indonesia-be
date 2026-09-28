import { Request, Response } from "express";
import { SqliteStore } from "../utils/sqliteStore";
import { PublicUser, User, USER_ROLE_OPTIONS, UserRole } from "../models/types";
import { ApiError } from "../middlewares/errorHandler";
import { hashPassword } from "../utils/password";
import { MODULE_KEYS } from "../config/permissions";

function parseAllowedModules(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ApiError(400, "allowedModules harus berupa array");
  const strings = value.map((v) => String(v));
  const validKeys: readonly string[] = MODULE_KEYS;
  const invalid = strings.filter((v) => !validKeys.includes(v));
  if (invalid.length > 0) throw new ApiError(400, `Modul tidak valid: ${invalid.join(", ")}`);
  return Array.from(new Set(strings));
}

export const userStore = new SqliteStore<User>("user");

const DEFAULT_SUPERADMIN_EMAIL = "superadmin@bengkelku.com";
const DEFAULT_SUPERADMIN_PASSWORD = "SuperAdmin123!";

async function seedDefaultSuperadmin() {
  const all = await userStore.findAll();
  if (all.some((u) => u.email === DEFAULT_SUPERADMIN_EMAIL)) return;
  await userStore.create({
    nama: "Super Admin",
    email: DEFAULT_SUPERADMIN_EMAIL,
    passwordHash: hashPassword(DEFAULT_SUPERADMIN_PASSWORD),
    role: "superadmin",
    aktif: true,
    createdAt: new Date().toISOString(),
  });
  console.log(`Seeded default superadmin: ${DEFAULT_SUPERADMIN_EMAIL} / ${DEFAULT_SUPERADMIN_PASSWORD}`);
}

seedDefaultSuperadmin().catch((err) => console.error("Gagal seed superadmin default:", err));

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const userController = {
  async list(_req: Request, res: Response) {
    res.json((await userStore.findAll()).map(toPublicUser));
  },

  async get(req: Request, res: Response) {
    const item = await userStore.findById(String(req.params.id));
    if (!item) throw new ApiError(404, "User tidak ditemukan");
    res.json(toPublicUser(item));
  },

  async create(req: Request, res: Response) {
    const { nama, email, password, role, aktif, allowedModules } = req.body;
    if (!nama || !email || !password) throw new ApiError(400, "nama, email, dan password wajib diisi");
    if (!USER_ROLE_OPTIONS.includes(role)) throw new ApiError(400, "role tidak valid");
    const all = await userStore.findAll();
    if (all.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      throw new ApiError(400, "Email sudah digunakan");
    }
    const item = await userStore.create({
      nama,
      email,
      passwordHash: hashPassword(password),
      role: role as UserRole,
      allowedModules: parseAllowedModules(allowedModules),
      aktif: aktif === undefined ? true : Boolean(aktif),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(toPublicUser(item));
  },

  async update(req: Request, res: Response) {
    const { password, role, allowedModules, ...rest } = req.body;
    if (role !== undefined && !USER_ROLE_OPTIONS.includes(role)) {
      throw new ApiError(400, "role tidak valid");
    }
    const patch: Partial<User> = { ...rest };
    if (role !== undefined) patch.role = role as UserRole;
    if (allowedModules !== undefined) patch.allowedModules = parseAllowedModules(allowedModules);
    if (password) patch.passwordHash = hashPassword(password);

    const item = await userStore.update(String(req.params.id), patch);
    if (!item) throw new ApiError(404, "User tidak ditemukan");
    res.json(toPublicUser(item));
  },

  async remove(req: Request, res: Response) {
    const target = await userStore.findById(String(req.params.id));
    if (!target) throw new ApiError(404, "User tidak ditemukan");
    if (target.role === "superadmin") {
      const all = await userStore.findAll();
      if (all.filter((u) => u.role === "superadmin").length <= 1) {
        throw new ApiError(400, "Tidak bisa menghapus satu-satunya akun superadmin");
      }
    }
    await userStore.delete(target.id);
    res.status(204).send();
  },
};
