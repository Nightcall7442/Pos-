import { Request, Response, NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { sendError } from "../utils/response.js";

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

/**
 * Токен доступа и токен обновления раньше отличались только секретом, которым
 * подписаны: полезная нагрузка у них была одна и та же. Если JWT_SECRET и
 * JWT_REFRESH_SECRET совпадут (запретить это было нечем — теперь запрещает
 * config/env.ts), refresh-токен работал бы как access и наоборот: пятнадцать
 * минут доступа превращались в семь дней. Поэтому тип написан в самом токене
 * и проверяется на входе.
 */
export type TokenType = "access" | "refresh";

export interface TokenClaims extends AuthUser {
  typ: TokenType;
  /**
   * Версия токенов пользователя. Пишется только в refresh-токен и сверяется с
   * users.token_version при обновлении: смена пароля увеличивает счётчик и тем
   * самым гасит все выданные ранее refresh-токены. Без этого украденный
   * refresh-токен жил свои семь дней, и смена пароля его не отменяла.
   */
  ver?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const env = getEnv();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "Authentication required", 401);
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenClaims;
    if (decoded.typ !== "access") {
      sendError(res, "Invalid or expired token", 401);
      return;
    }
    req.user = decoded;
    next();
  } catch {
    sendError(res, "Invalid or expired token", 401);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Authentication required", 401);
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      sendError(res, "Insufficient permissions", 403);
      return;
    }
    next();
  };
}

export function generateTokens(user: {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  tokenVersion?: number;
}) {
  const env = getEnv();
  const payload: AuthUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  // JWT_EXPIRES_IN приходит из окружения строкой ("15m", "7d"), а тип
  // SignOptions["expiresIn"] шире строки — приведение точечное, вместо двух
  // `as any`, которые гасили проверку всего объекта настроек.
  const accessOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  const refreshOptions: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };

  const accessToken = jwt.sign({ ...payload, typ: "access" }, env.JWT_SECRET, accessOptions);
  const refreshToken = jwt.sign(
    { ...payload, typ: "refresh", ver: user.tokenVersion ?? 0 },
    env.JWT_REFRESH_SECRET,
    refreshOptions
  );

  return { accessToken, refreshToken };
}
