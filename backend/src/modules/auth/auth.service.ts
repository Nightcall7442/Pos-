import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../../config/database.js";
import { getEnv } from "../../config/env.js";
import { generateTokens } from "../../middleware/auth.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { AppError, ConflictError, NotFoundError } from "../../utils/errors.js";

// bcrypt hash of a random string, used only to burn a comparable amount of
// time when no user matches.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Nx/8kcJj1xJd8eNoQ0e0Yx5jZ6lYQq";

export class AuthService {
  // The same email may exist in several tenants (each tenant has its own user
  // table scope), so every active match is checked — otherwise whichever row
  // the database happened to return first would be the only one able to log in.
  // The secret may be the password or the user's terminal PIN; both are hashed.
  async login(data: LoginInput, tenantId?: string) {
    const where: any = {
      email: data.email,
      isActive: true,
    };
    if (tenantId) where.tenantId = tenantId;

    const candidates = await prisma.user.findMany({ where, orderBy: { createdAt: "asc" } });

    let user: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(data.password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
      if (candidate.pin && (await bcrypt.compare(data.password, candidate.pin))) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      // Equalise timing a little so a wrong email is not measurably faster
      // than a wrong password.
      if (candidates.length === 0) await bcrypt.compare(data.password, DUMMY_HASH);
      throw new AppError("Неверный email или пароль", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("Email уже зарегистрирован");
    }

    const slug = data.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const passwordHash = await bcrypt.hash(data.password, 12);

    const tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug,
        users: {
          create: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: "admin",
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];

    const tokens = generateTokens({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    const env = getEnv();

    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
        id: string;
        tenantId: string;
        email: string;
        role: string;
        firstName: string;
        lastName: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || !user.isActive) {
        throw new NotFoundError("Пользователь не найден или отключён");
      }

      const tokens = generateTokens({
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      return tokens;
    } catch {
      throw new AppError("Недействительный refresh-токен", 401);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("Пользователь не найден");

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError("Текущий пароль неверен");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: "Password changed successfully" };
  }
}

export const authService = new AuthService();
