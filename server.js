const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.STOREFRONT_PORT || 5050);
const ADMIN_PASSWORD = process.env.STOREFRONT_ADMIN_PASSWORD || "change-me";
const WHATSAPP_NUMBER = process.env.STORE_WHATSAPP_NUMBER || "917845033001";
const STOREFRONT_PUBLIC_URL = getPublicStorefrontUrl(process.env.STOREFRONT_PUBLIC_URL);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "catalog.json");
const CARTS_FILE = path.join(DATA_DIR, "carts.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const PRODUCT_IMAGE_DIR = path.join(PUBLIC_DIR, "product-images");
const REVIEW_MEDIA_DIR = path.join(PUBLIC_DIR, "review-media");
const sessions = new Set();
const reviewSubmissionTimes = new Map();

function getPublicStorefrontUrl(value) {
  const configuredUrl = String(value || "").trim();
  if (!configuredUrl) return "";
  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("STOREFRONT_PUBLIC_URL must be an absolute HTTPS storefront URL");
  }
  if (url.protocol !== "https:" || !url.hostname || isLocalOrPrivateHostname(url.hostname)) {
    throw new Error("STOREFRONT_PUBLIC_URL must use HTTPS and a publicly reachable hostname");
  }
  return url.origin;
}

function isLocalOrPrivateHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || host === "0.0.0.0" || /^(fc|fd|fe[89ab])/i.test(host)) return true;
  const octets = host.split(".");
  if (octets.length !== 4 || octets.some(octet => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) return false;
  const [first, second] = octets.map(Number);
  return first === 0 || first === 10 || first === 127 || first === 169 && second === 254
    || first === 192 && second === 168 || first === 172 && second >= 16 && second <= 31;
}

const defaultCategoryGroups = [
  { name: "Necklace & Haaram", categories: ["AD Necklace", "AD Haaram", "Gold Lookalike Jewels", "Antique Necklace", "Antique Haaram"] },
  { name: "Earrings", categories: ["Fashion Earrings", "Antique Earrings", "Gold Lookalike Earrings", "Earrings"] },
  { name: "Bangles & Bracelets", categories: ["AD Bangles", "Antique Bangles", "Bracelets"] },
  { name: "Bridal Sets", categories: ["Bridal Sets"] },
  { name: "Rings", categories: ["Rings"] },
  { name: "Anklets", categories: ["Anklets"] },
  { name: "Fashion Accessories", categories: ["Fashion Accessories"] }
];

const starterCatalog = {
  shop: { name: "L'Ornement Fashion Jewels", location: "Villianur, Puducherry", whatsapp: WHATSAPP_NUMBER },
  categoryImages: {},
  categoryGroups: defaultCategoryGroups.map(group => ({ name: group.name, categories: [...group.categories] })),
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
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return starterCatalog;
  }
  catalog = ensureProductCodes(catalog);
  catalog.categoryImages = catalog.categoryImages || {};
  let migrated = !Array.isArray(catalog.categoryGroups);
  if (!Array.isArray(catalog.categoryGroups)) {
    catalog.categoryGroups = defaultCategoryGroups.map(group => ({ name: group.name, categories: [...group.categories] }));
  }
  catalog.categoryGroups = catalog.categoryGroups.filter(group => group && typeof group.name === "string" && Array.isArray(group.categories));
  for (const group of catalog.categoryGroups) {
    group.categories = group.categories.filter(category => typeof category === "string");
  }
  for (const group of defaultCategoryGroups) {
    if (!catalog.categoryGroups.some(existing => existing.name === group.name)) {
      catalog.categoryGroups.push({ name: group.name, categories: [...group.categories] });
      migrated = true;
    } else {
      const existing = catalog.categoryGroups.find(item => item.name === group.name);
      for (const category of group.categories) {
        if (!existing.categories.includes(category)) {
          existing.categories.push(category);
          migrated = true;
        }
      }
    }
  }
  for (const product of catalog.products) {
    if (!Array.isArray(product.images)) continue;
    product.images = product.images.map(image => {
      const storedImage = storeCatalogImage(image);
      if (storedImage !== image) migrated = true;
      return storedImage;
    });
  }
  for (const [category, image] of Object.entries(catalog.categoryImages)) {
    const storedImage = storeCatalogImage(image);
    if (storedImage !== image) {
      catalog.categoryImages[category] = storedImage;
      migrated = true;
    }
  }
  if (!Array.isArray(catalog.categories)) catalog.categories = [];
  for (const group of catalog.categoryGroups) {
    for (const category of group.categories) {
      if (!catalog.categories.includes(category)) {
        catalog.categories.push(category);
        migrated = true;
      }
    }
  }
  if (migrated) writeCatalog(catalog);
  return catalog;
}
function storeCatalogImage(image) {
  if (typeof image !== "string" || !image.startsWith("data:")) return image;
  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error("A catalog image has an unsupported or invalid data URL");
  const content = Buffer.from(match[2], "base64");
  const signatureValid = match[1] === "image/jpeg" ? content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
    : match[1] === "image/png" ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP";
  if (!content.length || !signatureValid) throw new Error("A catalog image has invalid image data");
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1] === "image/png" ? "png" : "webp";
  const filename = `${crypto.createHash("sha256").update(content).digest("hex")}.${extension}`;
  fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
  const filePath = path.join(PRODUCT_IMAGE_DIR, filename);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, { flag: "wx" });
  return `/product-images/${filename}`;
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
    items: Array.isArray(input.items) ? input.items.map(item => {
      const savedItem = { id: String(item.id), quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) };
      for (const field of ["name", "code", "category"]) {
        if (typeof item[field] === "string") savedItem[field] = item[field].trim().slice(0, field === "name" ? 160 : 120);
      }
      const price = item.price !== null && item.price !== "" && item.price !== undefined ? Number(item.price) : NaN;
      if (Number.isFinite(price) && price >= 0) savedItem.price = price;
      return savedItem;
    }).slice(0, 100) : [],
    customer: {
      name: String(input.customer?.name || "").trim().slice(0, 120),
      mobile: String(input.customer?.mobile || "").trim().slice(0, 30),
      address: String(input.customer?.address || "").trim().slice(0, 500)
    },
    updatedAt: new Date().toISOString()
  };
}
function send(res, status, body, type = "application/json", cacheControl = "no-store") {
  const payload = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": cacheControl });
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
function readReviews() {
  if (!fs.existsSync(REVIEWS_FILE)) return [];
  const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf8"));
  if (!Array.isArray(reviews)) throw new Error("Review data must be a list");
  return reviews;
}
function writeReviews(reviews) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}
function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
function validateReview(input) {
  const name = String(input.name || "").trim().slice(0, 80);
  const text = String(input.text || "").trim().slice(0, 1200);
  const rating = Number(input.rating);
  if (!name || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Enter your name, a review, and a rating from 1 to 5" };
  }
  if (!Array.isArray(input.media) || input.media.length > 4) return { error: "Add no more than 4 photos or videos" };
  return { name, text, rating };
}
async function storeReviewMedia(media) {
  const mimeTypes = {
    "image/jpeg": { extension: "jpg", max: 6 * 1024 * 1024 },
    "image/png": { extension: "png", max: 6 * 1024 * 1024 },
    "image/webp": { extension: "webp", max: 6 * 1024 * 1024 },
    "video/mp4": { extension: "mp4", max: 18 * 1024 * 1024 },
    "video/webm": { extension: "webm", max: 18 * 1024 * 1024 },
    "video/quicktime": { extension: "mov", max: 18 * 1024 * 1024 }
  };
  const saved = [];
  let totalBytes = 0;
  let videoCount = 0;
  try {
    fs.mkdirSync(REVIEW_MEDIA_DIR, { recursive: true });
    for (const item of media) {
      const type = mimeTypes[item.type];
      const match = typeof item.data === "string" && item.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);
      if (!type || !match || match[1] !== item.type) throw badRequest("Use JPG, PNG, or WebP photos and MP4, WebM, or MOV videos");
      const content = Buffer.from(match[2], "base64");
      if (!content.length || content.length > type.max) throw badRequest(`Each ${item.type.startsWith("video/") ? "video" : "photo"} must be within its upload size limit`);
      totalBytes += content.length;
      if (totalBytes > 24 * 1024 * 1024) throw badRequest("All review files together must be under 24 MB");
      const isVideo = item.type.startsWith("video/");
      if (isVideo) videoCount++;
      if (videoCount > 1) throw badRequest("Add at most one video per review");
      const validSignature = item.type === "image/jpeg" ? content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
        : item.type === "image/png" ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : item.type === "image/webp" ? content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP"
            : item.type === "video/webm" ? content.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
              : content.toString("ascii", 4, 8) === "ftyp";
      if (!validSignature) throw badRequest("A review file does not match its selected photo or video format");
      const filename = `${crypto.randomUUID()}.${type.extension}`;
      const filePath = path.join(REVIEW_MEDIA_DIR, filename);
      fs.writeFileSync(filePath, content, { flag: "wx" });
      saved.push({ path: filePath, media: { url: `/review-media/${filename}`, type: item.type, name: String(item.name || filename).slice(0, 120) } });
    }
    return saved.map(item => item.media);
  } catch (error) {
    for (const item of saved) {
      if (fs.existsSync(item.path)) fs.unlinkSync(item.path);
    }
    throw error;
  }
}
function removeReviewMedia(media) {
  for (const item of media || []) {
    const filename = path.basename(String(item.url || ""));
    const filePath = path.join(REVIEW_MEDIA_DIR, filename);
    if (filename && filePath.startsWith(`${REVIEW_MEDIA_DIR}${path.sep}`) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
function isAdmin(req) { return req.headers.authorization?.startsWith("Bearer ") && sessions.has(req.headers.authorization.slice(7)); }
function publicCatalog() { const catalog = readCatalog(); return { ...catalog, shop: { ...catalog.shop, whatsapp: catalog.shop.whatsapp || WHATSAPP_NUMBER, publicUrl: STOREFRONT_PUBLIC_URL }, products: catalog.products.filter(p => p.active !== false) }; }
function serveProductImage(res, filename) {
  if (!/^[a-f0-9]{64}\.(?:jpg|png|webp)$/.test(filename)) return send(res, 404, { error: "Not found" });
  const filePath = path.join(PRODUCT_IMAGE_DIR, filename);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return send(res, 404, { error: "Not found" });
  const type = filename.endsWith(".jpg") ? "image/jpeg" : filename.endsWith(".png") ? "image/png" : "image/webp";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" });
  fs.createReadStream(filePath).pipe(res);
}
function serveFile(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const relative = pathname === "/" || /^\/cart\/[a-f0-9]{16,64}$/.test(pathname) ? "index.html" : pathname === "/admin" ? "admin.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, { error: "Not found" });
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
  const type = types[path.extname(filePath)] || "application/octet-stream";
  const cacheControl = type.startsWith("image/") ? "public, max-age=86400" : "no-store";
  send(res, 200, fs.readFileSync(filePath), type, cacheControl);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const productImageMatch = url.pathname.match(/^\/product-images\/([^/]+)$/);
    if (productImageMatch && req.method === "GET") return serveProductImage(res, productImageMatch[1]);
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
    if (url.pathname === "/api/reviews" && req.method === "GET") {
      return send(res, 200, readReviews().filter(review => review.status === "published").sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    if (url.pathname === "/api/reviews" && req.method === "POST") {
      const input = await body(req);
      const validated = validateReview(input);
      if (validated.error) return send(res, 400, { error: validated.error });
      const client = req.socket.remoteAddress || "unknown";
      const recentSubmissions = (reviewSubmissionTimes.get(client) || []).filter(timestamp => Date.now() - timestamp < 60 * 60 * 1000);
      if (recentSubmissions.length >= 3) return send(res, 429, { error: "Please wait before submitting another review" });
      recentSubmissions.push(Date.now());
      reviewSubmissionTimes.set(client, recentSubmissions);
      const media = await storeReviewMedia(input.media);
      const review = { id: crypto.randomUUID(), ...validated, media, status: "pending", createdAt: new Date().toISOString() };
      const reviews = readReviews();
      reviews.unshift(review);
      writeReviews(reviews);
      return send(res, 201, { message: "Thanks for sharing! Your review will appear after our team approves it." });
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
    if (url.pathname === "/api/admin/reviews" && req.method === "GET") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      return send(res, 200, readReviews().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }
    if (url.pathname === "/api/admin/reviews" && req.method === "POST") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req);
      const validated = validateReview(input);
      if (validated.error) return send(res, 400, { error: validated.error });
      const media = await storeReviewMedia(input.media);
      const review = { id: crypto.randomUUID(), ...validated, media, status: "published", createdAt: new Date().toISOString() };
      const reviews = readReviews();
      reviews.unshift(review);
      writeReviews(reviews);
      return send(res, 201, review);
    }
    const reviewMatch = url.pathname.match(/^\/api\/admin\/reviews\/([^/]+)$/);
    if (reviewMatch && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req);
      if (!["pending", "published", "hidden"].includes(input.status)) return send(res, 400, { error: "Choose pending, published, or hidden status" });
      const reviews = readReviews();
      const review = reviews.find(item => item.id === reviewMatch[1]);
      if (!review) return send(res, 404, { error: "Review not found" });
      review.status = input.status;
      writeReviews(reviews);
      return send(res, 200, review);
    }
    if (reviewMatch && req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const reviews = readReviews();
      const index = reviews.findIndex(item => item.id === reviewMatch[1]);
      if (index < 0) return send(res, 404, { error: "Review not found" });
      removeReviewMedia(reviews[index].media);
      reviews.splice(index, 1);
      writeReviews(reviews);
      return send(res, 204, null);
    }
    if (url.pathname === "/api/admin/shop" && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const catalog = readCatalog();
      let whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
      if (whatsapp.length === 10) whatsapp = `91${whatsapp}`;
      if (whatsapp.length < 10 || whatsapp.length > 15) return send(res, 400, { error: "Enter a valid WhatsApp number with country code" });
      catalog.shop = { ...catalog.shop, whatsapp }; writeCatalog(catalog); return send(res, 200, catalog.shop);
    }
    if (url.pathname === "/api/admin/appearance" && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req);
      if (typeof input.heroImage !== "string" || !input.heroImage.trim()) return send(res, 400, { error: "Choose a hero image before saving" });
      const catalog = readCatalog();
      catalog.heroImage = storeCatalogImage(input.heroImage);
      writeCatalog(catalog);
      return send(res, 200, { heroImage: catalog.heroImage });
    }
    if (url.pathname === "/api/admin/products" && req.method === "POST") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const catalog = readCatalog();
      const product = { id: crypto.randomUUID(), code: makeProductCode(catalog.products), name: String(input.name || "").trim(), category: String(input.category || "Uncategorized").trim(), price: Number(input.price || 0), description: String(input.description || "").trim(), images: Array.isArray(input.images) ? input.images.filter(Boolean).slice(0, 8).map(storeCatalogImage) : [], active: true };
      if (!product.name || product.price <= 0 || !product.images.length) return send(res, 400, { error: "Name, price, and at least one uploaded photo are required" });
      catalog.products.unshift(product); if (!catalog.categories.includes(product.category)) catalog.categories.push(product.category); writeCatalog(catalog); return send(res, 201, product);
    }
    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req);
      const catalog = readCatalog();
      const product = catalog.products.find(item => item.id === productMatch[1]);
      if (!product) return send(res, 404, { error: "Product not found" });
      const name = String(input.name || "").trim();
      const category = String(input.category || "").trim();
      const price = Number(input.price);
      if (!name || name.length > 160 || !category || !Number.isFinite(price) || price <= 0) {
        return send(res, 400, { error: "Enter a product name, category, and valid price" });
      }
      if (!catalog.categories.includes(category)) return send(res, 400, { error: "Choose a valid product category" });
      if (input.images !== undefined && (!Array.isArray(input.images) || input.images.length > 8 || input.images.some(image => typeof image !== "string" || !image.trim()))) {
        return send(res, 400, { error: "Choose up to 8 valid product images" });
      }
      product.name = name;
      product.category = category;
      product.price = price;
      product.description = String(input.description || "").trim().slice(0, 1200);
      if (Array.isArray(input.images)) product.images = input.images.map(storeCatalogImage);
      writeCatalog(catalog);
      return send(res, 200, product);
    }
    if (productMatch && req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const catalog = readCatalog(); const index = catalog.products.findIndex(p => p.id === productMatch[1]);
      if (index < 0) return send(res, 404, { error: "Product not found" });
      catalog.products.splice(index, 1); writeCatalog(catalog); return send(res, 204, null);
    }
    if (url.pathname === "/api/admin/categories" && req.method === "POST") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const input = await body(req); const name = String(input.name || "").trim(); const image = storeCatalogImage(String(input.image || "").trim()); const groupName = String(input.group || "").trim(); const catalog = readCatalog();
      if (!name) return send(res, 400, { error: "Category name is required" });
      if (groupName && !catalog.categoryGroups.some(group => group.name === groupName)) return send(res, 400, { error: "Choose a valid category group" });
      if (!catalog.categories.includes(name)) catalog.categories.push(name);
      if (groupName) {
        const group = catalog.categoryGroups.find(item => item.name === groupName);
        if (!group.categories.includes(name)) group.categories.push(name);
      }
      if (image) catalog.categoryImages[name] = image;
      writeCatalog(catalog); return send(res, 201, { categories: catalog.categories, categoryGroups: catalog.categoryGroups, categoryImages: catalog.categoryImages });
    }
    const categoryMatch = url.pathname.match(/^\/api\/admin\/categories\/(.+)$/);
    if (categoryMatch && req.method === "PUT") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const oldName = decodeURIComponent(categoryMatch[1]); const input = await body(req); const newName = String(input.name || "").trim(); const groupName = String(input.group || "").trim(); const catalog = readCatalog();
      if (!catalog.categories.includes(oldName)) return send(res, 404, { error: "Category not found" });
      if (!newName) return send(res, 400, { error: "Category name is required" });
      if (newName !== oldName && catalog.categories.includes(newName)) return send(res, 409, { error: "That category already exists" });
      if (groupName && !catalog.categoryGroups.some(group => group.name === groupName)) return send(res, 400, { error: "Choose a valid category group" });
      const oldGroup = catalog.categoryGroups.find(group => group.categories.includes(oldName));
      catalog.categories = catalog.categories.map(category => category === oldName ? newName : category);
      catalog.products.forEach(product => { if (product.category === oldName) product.category = newName; });
      for (const group of catalog.categoryGroups) group.categories = group.categories.filter(category => category !== oldName);
      const targetGroup = groupName || oldGroup?.name;
      if (targetGroup) catalog.categoryGroups.find(group => group.name === targetGroup).categories.push(newName);
      if (catalog.categoryImages[oldName]) { catalog.categoryImages[newName] = catalog.categoryImages[oldName]; delete catalog.categoryImages[oldName]; }
      if (input.image) catalog.categoryImages[newName] = storeCatalogImage(String(input.image));
      writeCatalog(catalog); return send(res, 200, { categories: catalog.categories, categoryGroups: catalog.categoryGroups, categoryImages: catalog.categoryImages });
    }
    if (categoryMatch && req.method === "DELETE") {
      if (!isAdmin(req)) return send(res, 401, { error: "Admin login required" });
      const name = decodeURIComponent(categoryMatch[1]); const catalog = readCatalog();
      if (catalog.products.some(p => p.category === name)) return send(res, 409, { error: "Move or delete products in this category first" });
      catalog.categories = catalog.categories.filter(category => category !== name);
      for (const group of catalog.categoryGroups) group.categories = group.categories.filter(category => category !== name);
      delete catalog.categoryImages[name]; writeCatalog(catalog); return send(res, 204, null);
    }
    return serveFile(req, res);
  } catch (error) { return send(res, error.status || 500, { error: error.message || "Server error" }); }
});

server.listen(PORT, "0.0.0.0", () => console.log(`L'Ornement website running at http://localhost:${PORT}`));
