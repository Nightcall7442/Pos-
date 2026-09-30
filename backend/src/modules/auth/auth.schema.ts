import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  tenantName: z.string().min(1),
  // Café (tables, dine-in, takeaway) or shop (barcode scanner, weight, one check).
  businessType: z.enum(["cafe", "retail"]).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Terminal pairing: which shop's employee tiles to show, and which one of
// them was tapped plus the PIN they typed.
export const staffQuerySchema = z.object({
  tenant: z.string().min(1).max(100),
});

export const loginPinSchema = z.object({
  tenant: z.string().min(1).max(100),
  userId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,10}$/, "PIN — от 4 до 10 цифр"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type StaffQueryInput = z.infer<typeof staffQuerySchema>;
export type LoginPinInput = z.infer<typeof loginPinSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
