import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";
import { resolveSession } from "../controllers/auth.controller";
import { userStore } from "../controllers/user.controller";
import { PublicUser, UserRole } from "../models/types";
import { canAccessModule, ModuleKey } from "../config/permissions";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: PublicUser;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const session = resolveSession(extractToken(req));
  if (!session) throw new ApiError(401, "Belum login");
  const user = await userStore.findById(session.userId);
  if (!user || !user.aktif) throw new ApiError(401, "Belum login");
  const { passwordHash: _passwordHash, ...publicUser } = user;
  req.authUser = publicUser;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      throw new ApiError(403, "Tidak memiliki akses");
    }
    next();
  };
}

/** Gate a route by module, honoring a user's per-user `allowedModules` restriction on top of their role. */
export function requireModule(module: ModuleKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser || !canAccessModule(req.authUser, module)) {
      throw new ApiError(403, "Tidak memiliki akses");
    }
    next();
  };
}
