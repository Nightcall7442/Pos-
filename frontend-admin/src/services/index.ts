import api from "./api";

export interface LoginResponse {
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
}

export interface TechCardItem {
  ingredientId: string;
  quantity: number;
  unit: string;
  grossWeight?: number;
  netWeight?: number;
}

export interface TechCard {
  id: string;
  tenantId: string;
  name: string;
  ingredients: string;
  totalCost: number;
  output: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  products?: { id: string; name: string; price?: number }[];
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description?: string;
  volume?: string;
  sku: string;
  barcode?: string;
  imageUrl?: string;
  price: number;
  costPrice: number;
  compareAtPrice?: number;
  taxRate: number;
  unit: string;
  minStock: number;
  currentStock: number;
  trackInventory: boolean;
  isIngredient: boolean;
  techCardId?: string;
  techCardRef?: TechCard;
  techCard: string;
  preparationArea?: string;
  cookingMethod?: string;
  noDiscounts?: boolean;
  isActive: boolean;
  sortOrder: number;
  tags: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface Ingredient {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  currentStock: number;
  unit: string;
  purchaseUnit?: string;
  saleUnit?: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  color: string;
  sortOrder: number;
  isIngredient: boolean;
  markupPercent: number;
  isActive: boolean;
  _count?: { products: number };
}

export interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  tableId?: string;
  table?: { id: string; number: string };
  notes?: string;
  discountAmount?: number;
  payments?: { id: string; method: string; amount: number; status: string }[];
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  weightGrams?: number | null;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface RegisterInput {
  tenantName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  businessType?: "cafe" | "retail";
}

export const authService = {
  login: (email: string, password: string, tenantId?: string) =>
    api.post<ApiResponse<LoginResponse>>("/auth/login", { email, password }, { headers: tenantId ? { "x-tenant-id": tenantId } : {} }),
  register: (data: RegisterInput) => api.post<ApiResponse<LoginResponse>>("/auth/register", data),
  refreshToken: (refreshToken: string) => api.post("/auth/refresh", { refreshToken }),
  me: () => api.get("/auth/me"),
};

export const productService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<Product[]>>("/products", { params }),
  get: (id: string) => api.get<ApiResponse<Product>>(`/products/${id}`),
  create: (data: Partial<Product> & { techCard?: string }) => api.post<ApiResponse<Product>>("/products", data),
  update: (id: string, data: Partial<Product> & { techCard?: string }) => api.put<ApiResponse<Product>>(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  adjustStock: (id: string, data: { quantity: number; reason: string }) =>
    api.post(`/products/${id}/stock`, data),
  getIngredients: () => api.get<ApiResponse<Ingredient[]>>("/products/ingredients"),
  getTechCardCost: (id: string) => api.get<ApiResponse<{ cost: number }>>(`/products/${id}/tech-card-cost`),
};

/** What the shared barcode catalogue knows about a code — GET /catalog/lookup. */
export interface CatalogHit {
  found: true;
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  category: string | null;
  displayName: string;
  source: "snapshot" | "off" | "crowd";
}
export type CatalogAnswer = CatalogHit | { found: false; barcode: string; valid: boolean };

export interface CatalogAddInput {
  barcode: string;
  name: string;
  price: number;
  categoryId?: string;
  categoryName?: string;
  weighed?: boolean;
  stock?: number;
}

export const catalogService = {
  lookup: (code: string) => api.get<ApiResponse<CatalogAnswer>>("/catalog/lookup", { params: { code } }),
  add: (data: CatalogAddInput) => api.post<ApiResponse<Product>>("/catalog/add", data),
  stats: () => api.get<ApiResponse<{ total: number; crowd: number }>>("/catalog/stats"),
};

export const orderService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<Order[]>>("/orders", { params }),
  get: (id: string) => api.get<ApiResponse<Order>>(`/orders/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/orders/${id}/status`, { status }),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
  getActive: () => api.get<ApiResponse<Order[]>>("/orders/active"),
  create: (data: Record<string, unknown>) => api.post("/orders", data),
};

export const paymentService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get("/payments", { params }),
  getSummary: (params?: Record<string, string | number | boolean | undefined>) => api.get("/payments/summary", { params }),
};

export const categoryService = {
  list: () => api.get<ApiResponse<Category[]>>("/categories"),
  get: (id: string) => api.get<ApiResponse<Category>>(`/categories/${id}`),
  create: (data: { name: string; color: string; description?: string; imageUrl?: string; isIngredient?: boolean; markupPercent?: number }) => api.post<ApiResponse<Category>>("/categories", data),
  update: (id: string, data: { name: string; color: string; description?: string; imageUrl?: string; isIngredient?: boolean; markupPercent?: number }) => api.put<ApiResponse<Category>>(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const userService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<User[]>>("/users", { params }),
  get: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),
  // pin: 4–10 цифр для входа на кассе по имени. Пустая строка при
  // обновлении снимает PIN, отсутствие поля — оставляет как было.
  create: (data: { email: string; password: string; firstName: string; lastName: string; role: string; pin?: string }) => api.post("/users", data),
  update: (id: string, data: Partial<User> & { password?: string; pin?: string }) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  toggleActive: (id: string) => api.post(`/users/${id}/toggle`),
};

export const inventoryService = {
  getStock: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<Product[]>>("/inventory/stock", { params }),
  getAlerts: () => api.get<ApiResponse<Product[]>>("/inventory/alerts"),
  adjustStock: (id: string, data: { quantity: number; reason: string }) => api.post(`/inventory/${id}/adjust`, data),
};

export const reportService = {
  getDashboard: () => api.get("/reports/dashboard"),
  getSales: (params: Record<string, string>) => api.get("/reports/sales", { params }),
  getEmployees: (params: Record<string, string>) => api.get("/reports/employees", { params }),
};

export const tableService = {
  list: () => api.get("/tables"),
  get: (id: string) => api.get(`/tables/${id}`),
  create: (data: { number: string; capacity: number; zone: string }) => api.post("/tables", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/tables/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/tables/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/tables/${id}`),
  getStats: () => api.get("/tables/stats"),
};

export const settingsService = {
  get: () => api.get("/settings"),
  update: (data: Record<string, unknown>) => api.put("/settings", data),
};

export const stockReceiptService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get("/stock-receipts", { params }),
  get: (id: string) => api.get(`/stock-receipts/${id}`),
  create: (data: { supplierName?: string; invoiceNumber?: string; notes?: string; items: { productId: string; quantity: number; costPrice: number }[] }) =>
    api.post("/stock-receipts", data),
  delete: (id: string) => api.delete(`/stock-receipts/${id}`),
};

export const cashShiftService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get("/cash-shifts", { params }),
  get: (id: string) => api.get(`/cash-shifts/${id}`),
  getCurrent: () => api.get("/cash-shifts/current"),
  open: (data: { openingCash: number; notes?: string }) => api.post("/cash-shifts/open", data),
  close: (id: string, data: { closingCash: number; notes?: string }) => api.post(`/cash-shifts/${id}/close`, data),
};

export const techCardService = {
  list: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<TechCard[]>>("/tech-cards", { params }),
  get: (id: string) => api.get<ApiResponse<TechCard>>(`/tech-cards/${id}`),
  create: (data: { name: string; ingredients?: TechCardItem[]; output?: number; unit?: string }) =>
    api.post<ApiResponse<TechCard>>("/tech-cards", data),
  update: (id: string, data: Partial<{ name: string; ingredients: TechCardItem[]; output: number; unit: string }>) =>
    api.put<ApiResponse<TechCard>>(`/tech-cards/${id}`, data),
  delete: (id: string) => api.delete(`/tech-cards/${id}`),
  copy: (id: string) => api.post<ApiResponse<TechCard>>(`/tech-cards/${id}/copy`),
  recalculate: (id: string) => api.post<ApiResponse<TechCard>>(`/tech-cards/${id}/recalculate`),
};
