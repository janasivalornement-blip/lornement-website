const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.STOREFRONT_PORT || 5050);
const ADMIN_PASSWORD = process.env.STOREFRONT_ADMIN_PASSWORD || "change-me";
const WHATSAPP_NUMBER = process.env.STORE_WHATSAPP_NUMBER || "917845033001";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "catalog.json");
const CARTS_FILE = path.join(DATA_DIR, "carts.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const sessions = new Set();

const starterCatalog = {
  shop: { name: "L'Ornement Fashion Jewels", location: "Villianur, Puducherry", whatsapp: WHATSAPP_NUMBER },
  categoryImages: {},
  categories: ["New In", "Earrings", "Necklaces", "Bangles", "Rings"],
  products: [
    { id: "starter-shell", name: "Shell Fan Set", category: "New In", price: 85, description: "A graceful everyday set with a soft shell-inspired silhouette.", images: ["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=84"], active: true },
    { id: "starter-nail", name: "Nail Bracelet", category: "Bangles", price: 75, description: "A minimal gold-tone bracelet made for stacking or wearing solo.", images: ["https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=84"], active: true },
    { id: "starter-bow", name: "Silver Bow Chain", category: "Necklaces", price: 30, description: "A delicate bow pendant with a polished silver finish.", images: ["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=84"], active: true },
    { id: "starter-clover", name: "Three Clover Chain", category: "Necklaces", price: 130, description: "A floral chain that brings a little light to daily dressing.", images: ["https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=900&q=84"], active: true }
  ]
};

function readCatalog() {
  if (!fs.existsSync(DATA_FILE)) return starterCatalog;
  try {
    const catalog = ensureProductCodes(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
    catalog.categoryImages = catalog.categoryImages || {};
    return catalog;
  } catch { return starterCatalog; }
}
function makeProductCode(products) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do { code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(""); } while (products.some(product => product.code === code));
  return code;
}
function ensureProductCodes(catalog) {
  const used = new Set();
  catalog.products = (catalog.products || []).map(product => {
    if (!product.code || product.code.length !== 5 || used.has(product.code)) product.code = makeProductCode([...catalog.products.filter(item => item !== product), ...Array.from(used, code => ({ code }))]);
    used.add(product.code);
    return product;
  });
  return catalog;
}
function writeCatalog(catalog) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(catalog, null, 2));
}
function readCarts() {
  if (!fs.existsSync(CARTS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CARTS_FILE, "utf8")); } catch { return {}; }
}
function writeCarts(carts) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CARTS_FILE, JSON.stringify(carts, null, 2));
}
function cartPayload(input) {
  return {
    items: Array.isArray(input.items) ? input.items.map(item => ({ id: String(item.id), quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) })).slice(0, 100) : [],
    customer: {
      name: String(input.customer?.name || "").trim().slice(0, 120),
      mobile: String(input.customer?.mobile || "").trim().slice(0, 30),
      address: String(input.customer?.address || "").trim().slice(0, 500)
    },
    updatedAt: new Date().toISOString()
  };
}
function send(res, status, body, type = "application/json") {
  const payload = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
  res.end(payload);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 45 * 1024 * 1024) req.destroy(); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function isAdmin(req) { return req.headers.authorization?.startsWith("Bearer ") && sessions.has(req.headers.authorization.slice(7)); }
function publicCatalog() { const catalog = readCatalog(); return { ...catalog, shop: { ...catalog.shop, whatsapp: catalog.shop.whatsapp || WHATSAPP_NUMBER }, products: catalog.products.filter(p => p.active !== false) }; }
function serveFile(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const relative = pathname === "/" || /^\/cart\/[a-f0-9]{16,64}$/.test(pathname) ? "index.html" : pathname === "/admin" ? "admin.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, { error: "Not found" });
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  send(res, 200, fs.readFileSync(filePath), types[path.extname(filePath)] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/catalog" && req.method === "GET") return send(res, 200, publicCatalog());
    if (url.pathname === "/api/cart" && req.method === "POST") {
      const carts = readCarts(); const id = crypto.randomBytes(16).toString("hex"); carts[id] = cartPayload(await body(req)); writeCarts(carts);
      return send(res, 201, { id, ...carts[id] });
    }
    const cartMatch = url.pathname.match(/^\/api\/cart\/([a-f0-9]{16,64})$/);
    if (cartMatch && req.method === "GET") {
      const cart = readCarts()[cartMatch[1]];
      return cart ? send(res, 200, { id: cartMatch[1], ...cart }) : send(res, 404, { error: "Cart not found" });
    }
    if (cartMatch && req.method === "PUT") {
      const carts = readCarts(); if (!carts[cartMatch[1]]) return send(res, 404, { error: "Cart not found" });
      carts[cartMatch[1]] = cartPayload(await body(req)); writeCarts(carts); return send(res, 200, { id: cartMatch[1], ...carts[cartMatch[1]] });
    }
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const input = await body(req);
      if (String(input.password || "") !== ADMIN_PASSWORD) return send(res, 401, { error: "Incorrect password" });
      const token = crypto.randomBytes(24).toString("hex"); sessions.add(token); return send(res, 200, { token });
    }
    if (url.pathname === "/api/admin/catalog" && req.method === "GET") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      return send(res, 200, readCatalog());
    }
    if (url.pathname === "/api/admin/shop" && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const catalog = readCatalog();
      let whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
      if (whatsapp.length === 10) whatsapp = `91${whatsapp}`;
      if (whatsapp.length < 10 || whatsapp.length > 15) return send(res, 400, { error: "Enter a valid WhatsApp number with country code" });
      catalog.shop = { ...catalog.shop, whatsapp }; writeCatalog(catalog); return send(res, 200, catalog.shop);
    }
    if (url.pathname === "/api/admin/products" && req.method === "POST") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const catalog = readCatalog();
      const product = { id: crypto.randomUUID(), code: makeProductCode(catalog.products), name: String(input.name || "").trim(), category: String(input.category || "Uncategorized").trim(), price: Number(input.price || 0), description: String(input.description || "").trim(), images: Array.isArray(input.images) ? input.images.filter(Boolean).slice(0, 8) : [], active: true };
      if (!product.name || product.price <= 0 || !product.images.length) return send(res, 400, { error: "Name, price, and at least one uploaded photo are required" });
      catalog.products.unshift(product); if (!catalog.categories.includes(product.category)) catalog.categories.push(product.category); writeCatalog(catalog); return send(res, 201, product);
    }
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch && req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const catalog = readCatalog(); const index = catalog.products.findIndex(p => p.id === productMatch[1]);
      if (index < 0) return send(res, 404, { error: "Product not found" });
      catalog.products.splice(index, 1); writeCatalog(catalog); return send(res, 204, null);
    }
    if (url.pathname === "/api/admin/categories" && req.method === "POST") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const name = String(input.name || "").trim(); const image = String(input.image || "").trim(); const catalog = readCatalog();
      if (!name) return send(res, 400, { error: "Category name is required" });
      if (!catalog.categories.includes(name)) catalog.categories.push(name);
      if (image) catalog.categoryImages[name] = image;
      writeCatalog(catalog); return send(res, 201, { categories: catalog.categories, categoryImages: catalog.categoryImages });
    }
    const categoryMatch = url.pathname.match(/^\/api\/admin\/categories\/(.+)$/);
    if (categoryMatch && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const oldName = decodeURIComponent(categoryMatch[1]); const input = await body(req); const newName = String(input.name || "").trim(); const catalog = readCatalog();
      if (!catalog.categories.includes(oldName)) return send(res, 404, { error: "Category not found" });
      if (!newName) return send(res, 400, { error: "Category name is required" });
      if (newName !== oldName && catalog.categories.includes(newName)) return send(res, 409, { error: "That category already exists" });
      catalog.categories = catalog.categories.map(category => category === oldName ? newName : category);
      catalog.products.forEach(product => { if (product.category === oldName) product.category = newName; });
      if (catalog.categoryImages[oldName]) { catalog.categoryImages[newName] = catalog.categoryImages[oldName]; delete catalog.categoryImages[oldName]; }
      if (input.image) catalog.categoryImages[newName] = String(input.image);
      writeCatalog(catalog); return send(res, 200, { categories: catalog.categories, categoryImages: catalog.categoryImages });
    }
    if (categoryMatch && req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const name = decodeURIComponent(categoryMatch[1]); const catalog = readCatalog();
      if (catalog.products.some(p => p.category === name)) return send(res, 409, { error: "Move or delete products in this category first" });
      catalog.categories = catalog.categories.filter(category => category !== name); delete catalog.categoryImages[name]; writeCatalog(catalog); return send(res, 204, null);
    }
    return serveFile(req, res);
  } catch (error) { return send(res, 500, { error: error.message || "Server error" }); }
});

server.listen(PORT, "0.0.0.0", () => console.log(`L'Ornement website running at http://localhost:${PORT}`));
