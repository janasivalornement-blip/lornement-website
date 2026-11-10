async function compressCatalogImage(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this image for upload.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("Could not compress this image for upload.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(blob);
  });
}
document.addEventListener("click", async event => { const save = event.target.closest("[data-save-category]"); if (save) { const oldName = decodeURIComponent(save.dataset.saveCategory); const input = document.querySelector(`[data-category-name="${save.dataset.saveCategory}"]`); const group = document.querySelector(`[data-category-parent="${save.dataset.saveCategory}"]`); const newName = input?.value.trim(); if (!newName) return alert("Category name is required"); try { await request(`/api/admin/categories/${encodeURIComponent(oldName)}`, { method: "PUT", body: JSON.stringify({ name: newName, group: group?.value }) }); await loadCatalog(); } catch (error) { alert(error.message); } return; } const imageButton = event.target.closest("[data-category-image]"); if (imageButton) document.querySelector(`[data-category-file="${imageButton.dataset.categoryImage}"]`)?.click(); });
document.addEventListener("change", async event => { const input = event.target.closest("[data-category-file]"); if (!input || !input.files[0]) return; const category = decodeURIComponent(input.dataset.categoryFile); try { const image = await compressCatalogImage(input.files[0]); await request(`/api/admin/categories/${encodeURIComponent(category)}`, { method: "PUT", body: JSON.stringify({ name: category, image }) }); await loadCatalog(); } catch (error) { alert(error.message); } });
const imageUrlLabel = document.querySelector("#productForm [name=imageUrls]")?.closest("label"); if (imageUrlLabel) imageUrlLabel.remove();
let categoryImageInput = document.createElement("input"); categoryImageInput.type = "file"; categoryImageInput.accept = "image/*"; categoryImageInput.id = "categoryImage";
const categoryImageLabel = document.createElement("label"); categoryImageLabel.textContent = "Category tile image "; categoryImageLabel.append(categoryImageInput); document.querySelector("#categoryForm")?.insertBefore(categoryImageLabel, document.querySelector("#categoryForm button"));
categoryImageInput.addEventListener("change", async event => { const file = event.target.files[0]; categoryImage = ""; categoryImageInput.disabled = true; if (!file) { categoryImageInput.disabled = false; return; } try { categoryImage = await compressCatalogImage(file); } catch (error) { alert(error.message); } finally { categoryImageInput.disabled = false; } });
document.addEventListener("submit", async event => { if (event.target.id !== "categoryForm") return; event.preventDefault(); event.stopImmediatePropagation(); const form = new FormData(event.target); try { await request("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: form.get("name"), group: form.get("group"), image: categoryImage }) }); event.target.reset(); categoryImage = ""; categoryImageInput.value = ""; await loadCatalog(); } catch (error) { alert(error.message); } }, true);
const $ = selector => document.querySelector(selector); let token = localStorage.getItem("lornement-admin-token") || ""; let catalog = { products: [], categories: [], categoryImages: {} }; let uploadedImages = []; let existingImages = []; let categoryImage = ""; let productSearch = ""; let adminReviews = []; let uploadedReviewMedia = []; let editingProductId = "";
async function request(path, options = {}) { const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } }); if (!response.ok) { const result = await response.json().catch(() => ({})); if (response.status === 401 && token) { token = ""; localStorage.removeItem("lornement-admin-token"); $("#dashboard").hidden = true; $("#loginView").hidden = false; $("#loginError").textContent = "Your admin session expired. Please sign in again."; } throw new Error(result.error || "Something went wrong"); } return response.status === 204 ? null : response.json(); }
function showDashboard() { $("#loginView").hidden = true; $("#dashboard").hidden = false; loadCatalog().catch(error => { $("#productMessage").textContent = error.message; }); loadAdminReviews().catch(error => { $("#adminReviewMessage").textContent = error.message; }); }
async function loadCatalog() { catalog = await request("/api/admin/catalog"); renderAll(); }
function renderAll() {
  const groups = catalog.categoryGroups || [];
  $("#categorySelect").innerHTML = groups.map(group => `<optgroup label="${escapeHtml(group.name)}">${group.categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</optgroup>`).join("");
  $("#categoryGroupSelect").innerHTML = groups.map(group => `<option value="${escapeHtml(group.name)}">${escapeHtml(group.name)}</option>`).join("");
  const query = productSearch.trim().toLowerCase();
  const products = catalog.products.filter(product => !query || [product.code, product.name, product.category, product.description].some(value => String(value || "").toLowerCase().includes(query)));
  $("#productCount").textContent = query ? `${products.length} of ${catalog.products.length}` : `${catalog.products.length} total`;
  $("#productStat").textContent = catalog.products.length;
  $("#categoryStat").textContent = catalog.categories.length;
  $("#reviewStat").textContent = adminReviews.length;
  $("#adminProducts").innerHTML = products.map(product => `<article class="admin-product"><img src="${escapeHtml(product.images[0] || "/category-images/all-items.jpg")}" alt="" loading="lazy" /><div class="admin-product-copy"><h3>${escapeHtml(product.name)}</h3><p class="product-code">${escapeHtml(product.code || "No code")} <span>·</span> ${escapeHtml(product.category)}</p><p class="product-price">₹${Number(product.price).toLocaleString("en-IN")} <span>· ${product.images.length} photo${product.images.length === 1 ? "" : "s"}</span></p></div><div class="product-actions"><button class="edit-button" type="button" data-edit-product="${escapeHtml(product.id)}">Edit</button><button class="delete" type="button" data-delete-product="${escapeHtml(product.id)}" aria-label="Delete ${escapeHtml(product.name)}">×</button></div></article>`).join("") || `<p class="empty-products">${query ? "No pieces match that search." : "Your catalogue is ready for its first piece."}</p>`;
  const groupedCategories = new Set(groups.flatMap(group => group.categories));
  const renderCategory = (category, groupName) => {
    const encoded = encodeURIComponent(category);
    const parentOptions = groups.map(group => `<option value="${escapeHtml(group.name)}" ${group.name === groupName ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    return `<div class="category-row"><input class="category-name-input" data-category-name="${encoded}" value="${escapeHtml(category)}" aria-label="Category name" /><select data-category-parent="${encoded}" aria-label="Category group">${parentOptions}</select><button class="category-save" data-save-category="${encoded}">Save</button><button class="category-image-edit" data-category-image="${encoded}">Choose new image</button><input class="category-image-file" data-category-file="${encoded}" type="file" accept="image/*" hidden /><button class="delete" data-delete-category="${encoded}" aria-label="Delete ${escapeHtml(category)}">×</button></div>`;
  };
  $("#adminCategories").innerHTML = groups.map(group => `<section class="category-group"><h3>${escapeHtml(group.name)}</h3>${group.categories.map(category => renderCategory(category, group.name)).join("")}</section>`).join("") + catalog.categories.filter(category => !groupedCategories.has(category)).map(category => renderCategory(category, "")).join("");
  if ($("#whatsappNumber")) $("#whatsappNumber").value = catalog.shop?.whatsapp || "";
  const heroImagePreview = $("#heroImagePreview");
  if (heroImagePreview) {
    heroImagePreview.hidden = !catalog.heroImage;
    heroImagePreview.src = catalog.heroImage || "";
    $("#heroImagePreviewEmpty").hidden = Boolean(catalog.heroImage);
  }
}
async function loadAdminReviews() {
  adminReviews = await request("/api/admin/reviews");
  renderAdminReviews();
}
function renderAdminReviews() {
  const pending = adminReviews.filter(review => review.status === "pending").length;
  $("#adminReviewCount").textContent = `${adminReviews.length} total · ${pending} pending`;
  $("#reviewStat").textContent = adminReviews.length;
  $("#adminReviews").innerHTML = adminReviews.map(review => {
    const media = (review.media || []).map(item => item.type.startsWith("video/")
      ? `<video controls preload="metadata" src="${escapeHtml(item.url)}" aria-label="Review video"></video>`
      : `<img src="${escapeHtml(item.url)}" alt="Review photo" loading="lazy" />`).join("");
    const nextStatus = review.status === "published" ? "hidden" : "published";
    const action = review.status === "pending" ? "Approve" : review.status === "published" ? "Hide" : "Publish";
    return `<article class="admin-review"><div class="admin-review-head"><div><strong>${escapeHtml(review.name)}</strong><span class="admin-review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span></div><span class="review-status ${escapeHtml(review.status)}">${escapeHtml(review.status)}</span></div><p>${escapeHtml(review.text)}</p>${media ? `<div class="review-media-preview">${media}</div>` : ""}<div class="admin-review-actions"><button type="button" class="category-save" data-review-status="${escapeHtml(review.id)}" data-next-status="${nextStatus}">${action}</button><button type="button" class="review-delete-button" data-review-delete="${escapeHtml(review.id)}">Delete review</button></div></article>`;
  }).join("") || `<p class="form-message">No reviews yet.</p>`;
}
function readReviewMedia(files) {
  return Promise.all([...files].map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  })));
}
function renderReviewUploadPreview(files) {
  const target = $("#adminReviewMediaPreview");
  if (files.length > 4) {
    target.innerHTML = `<p class="form-message">Choose no more than 4 photos or videos.</p>`;
    return false;
  }
  if ([...files].some(file => file.type.startsWith("image/") && file.size > 6 * 1024 * 1024 || file.type.startsWith("video/") && file.size > 18 * 1024 * 1024) || [...files].reduce((total, file) => total + file.size, 0) > 24 * 1024 * 1024) {
    target.innerHTML = `<p class="form-message">Photos must be under 6 MB, videos under 18 MB, and all files under 24 MB total.</p>`;
    return false;
  }
  target.innerHTML = [...files].map(file => `<span>${escapeHtml(file.name)} · ${(file.size / (1024 * 1024)).toFixed(1)} MB</span>`).join("");
  return true;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char])); }
$("#loginForm").addEventListener("submit", async event => { event.preventDefault(); $("#loginError").textContent = ""; try { const result = await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#password").value }) }); token = result.token; localStorage.setItem("lornement-admin-token", token); showDashboard(); } catch (error) { $("#loginError").textContent = error.message; } });
$("#logout").addEventListener("click", () => { token = ""; localStorage.removeItem("lornement-admin-token"); location.reload(); });
$("#imageFiles").addEventListener("change", async event => {
  const files = [...event.target.files];
  event.target.value = "";
  if (!files.length) return;
  const remainingSlots = 8 - existingImages.length - uploadedImages.length;
  if (files.length > remainingSlots) {
    $("#productMessage").textContent = `You can add ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} (8 total maximum).`;
    return;
  }
  const submit = $("#productSubmit");
  submit.disabled = true;
  $("#productMessage").textContent = "Optimizing images…";
  try {
    uploadedImages.push(...await Promise.all(files.map(compressCatalogImage)));
    renderProductImagePreviews();
    $("#productMessage").textContent = `${existingImages.length + uploadedImages.length} photo${existingImages.length + uploadedImages.length === 1 ? "" : "s"} selected.`;
  } catch (error) {
    $("#productMessage").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
function renderProductImagePreviews() {
  $("#existingImages").innerHTML = existingImages.map((src, index) => `<div class="product-image-preview"><img src="${escapeHtml(src)}" alt="Current product photo ${index + 1}" loading="lazy" /><button class="remove-product-image" type="button" data-remove-existing-image="${index}" aria-label="Remove current photo ${index + 1}">×</button></div>`).join("");
  $("#existingImages").hidden = !existingImages.length;
  $("#uploadPreview").innerHTML = uploadedImages.map((src, index) => `<div class="product-image-preview"><img src="${escapeHtml(src)}" alt="New product photo ${index + 1}" /><button class="remove-product-image" type="button" data-remove-uploaded-image="${index}" aria-label="Remove new photo ${index + 1}">×</button></div>`).join("");
}
document.addEventListener("click", event => {
  const removeExisting = event.target.closest("[data-remove-existing-image]");
  const removeUploaded = event.target.closest("[data-remove-uploaded-image]");
  if (!removeExisting && !removeUploaded) return;
  if (removeExisting) existingImages.splice(Number(removeExisting.dataset.removeExistingImage), 1);
  if (removeUploaded) uploadedImages.splice(Number(removeUploaded.dataset.removeUploadedImage), 1);
  renderProductImagePreviews();
  const count = existingImages.length + uploadedImages.length;
  $("#productMessage").textContent = `${count} photo${count === 1 ? "" : "s"} selected.`;
});
function resetProductEditor() {
  editingProductId = "";
  uploadedImages = [];
  existingImages = [];
  $("#productForm").reset();
  $("#uploadPreview").innerHTML = "";
  $("#existingImages").hidden = true;
  $("#existingImages").innerHTML = "";
  $("#productFormTitle").textContent = "Add a product";
  $("#productSubmit").innerHTML = 'Add product <span aria-hidden="true">→</span>';
  $("#cancelEdit").hidden = true;
  $("#productMessage").textContent = "";
}
function startProductEdit(id) {
  const product = catalog.products.find(item => String(item.id) === String(id));
  if (!product) return;
  editingProductId = String(product.id);
  uploadedImages = [];
  existingImages = [...(product.images || [])];
  $("#productForm").elements.name.value = product.name || "";
  $("#productForm").elements.category.value = product.category || "";
  $("#productForm").elements.price.value = product.price || "";
  $("#productForm").elements.description.value = product.description || "";
  $("#imageFiles").value = "";
  $("#uploadPreview").innerHTML = "";
  renderProductImagePreviews();
  $("#productFormTitle").textContent = "Edit product";
  $("#productSubmit").innerHTML = 'Save changes <span aria-hidden="true">→</span>';
  $("#cancelEdit").hidden = false;
  $("#productMessage").textContent = "";
  $("#productEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("#cancelEdit").addEventListener("click", resetProductEditor);
$("#productForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const editing = Boolean(editingProductId);
  const payload = {
    name: form.get("name"),
    category: form.get("category"),
    price: form.get("price"),
    description: form.get("description"),
    ...(editing ? { images: [...existingImages, ...uploadedImages] } : uploadedImages.length ? { images: uploadedImages } : {})
  };
  const submit = $("#productSubmit");
  submit.disabled = true;
  submit.textContent = editing ? "Saving changes…" : "Adding product…";
  $("#productMessage").textContent = "";
  try {
    const url = editing ? `/api/admin/products/${encodeURIComponent(editingProductId)}` : "/api/admin/products";
    await request(url, { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
    resetProductEditor();
    $("#productMessage").textContent = editing ? "Product updated." : "Product added.";
    await loadCatalog();
  } catch (error) {
    $("#productMessage").textContent = error.message;
    $("#productSubmit").innerHTML = editing ? 'Save changes <span aria-hidden="true">→</span>' : 'Add product <span aria-hidden="true">→</span>';
  } finally {
    submit.disabled = false;
  }
});
$("#categoryForm").addEventListener("submit", async event => { event.preventDefault(); const form = new FormData(event.target); try { await request("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: form.get("name"), group: form.get("group") }) }); event.target.reset(); await loadCatalog(); } catch (error) { alert(error.message); } });
$("#adminSearch").addEventListener("input", event => { productSearch = event.target.value; renderAll(); });
document.addEventListener("click", async event => {
  const edit = event.target.closest("[data-edit-product]");
  if (edit) { startProductEdit(edit.dataset.editProduct); return; }
  const product = event.target.closest("[data-delete-product]");
  if (product && confirm("Delete this product? This cannot be undone.")) {
    try { await request(`/api/admin/products/${encodeURIComponent(product.dataset.deleteProduct)}`, { method: "DELETE" }); await loadCatalog(); }
    catch (error) { $("#productMessage").textContent = error.message; }
  }
  const category = event.target.closest("[data-delete-category]");
  if (category && confirm("Delete this category?")) {
    try { await request(`/api/admin/categories/${category.dataset.deleteCategory}`, { method: "DELETE" }); await loadCatalog(); }
    catch (error) { alert(error.message); }
  }
});
$("#shopForm").addEventListener("submit", async event => { event.preventDefault(); const form = new FormData(event.target); $("#shopMessage").textContent = "Saving..."; try { await request("/api/admin/shop", { method: "PUT", body: JSON.stringify({ whatsapp: form.get("whatsapp") }) }); $("#shopMessage").textContent = "WhatsApp number updated."; await loadCatalog(); } catch (error) { $("#shopMessage").textContent = error.message; } });
let uploadedHeroImage = "";
$("#heroImageFile").addEventListener("change", async event => {
  uploadedHeroImage = "";
  $("#saveHeroImage").disabled = true;
  const file = event.target.files[0];
  if (!file) return;
  $("#heroImageMessage").textContent = "Optimizing image…";
  try {
    uploadedHeroImage = await compressCatalogImage(file);
    $("#heroImagePreview").src = uploadedHeroImage;
    $("#heroImagePreview").hidden = false;
    $("#heroImagePreviewEmpty").hidden = true;
    $("#saveHeroImage").disabled = false;
    $("#heroImageMessage").textContent = "Preview ready. Save to publish this hero image.";
  } catch (error) {
    $("#heroImageMessage").textContent = error.message;
  }
});
$("#heroImageForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!uploadedHeroImage) return;
  const saveButton = $("#saveHeroImage");
  saveButton.disabled = true;
  $("#heroImageMessage").textContent = "Saving hero image…";
  try {
    await request("/api/admin/appearance", { method: "PUT", body: JSON.stringify({ heroImage: uploadedHeroImage }) });
    uploadedHeroImage = "";
    $("#heroImageFile").value = "";
    $("#heroImageMessage").textContent = "Hero image updated on the storefront.";
    await loadCatalog();
  } catch (error) {
    $("#heroImageMessage").textContent = error.message;
    saveButton.disabled = false;
  }
});
$("#adminReviewMedia").addEventListener("change", event => { renderReviewUploadPreview(event.target.files); });
$("#adminReviewForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const files = form.elements.media.files;
  const message = $("#adminReviewMessage");
  if (!renderReviewUploadPreview(files)) return;
  message.textContent = "Saving review…";
  try {
    uploadedReviewMedia = await readReviewMedia(files);
    await request("/api/admin/reviews", { method: "POST", body: JSON.stringify({ name: form.elements.name.value, rating: form.elements.rating.value, text: form.elements.text.value, media: uploadedReviewMedia }) });
    form.reset();
    uploadedReviewMedia = [];
    $("#adminReviewMediaPreview").textContent = "";
    message.textContent = "Review added and published.";
    await loadAdminReviews();
  } catch (error) {
    message.textContent = error.message;
  }
});
document.addEventListener("click", async event => {
  const statusButton = event.target.closest("[data-review-status]");
  if (statusButton) {
    try {
      await request(`/api/admin/reviews/${encodeURIComponent(statusButton.dataset.reviewStatus)}`, { method: "PUT", body: JSON.stringify({ status: statusButton.dataset.nextStatus }) });
      await loadAdminReviews();
    } catch (error) {
      $("#adminReviewMessage").textContent = error.message;
    }
    return;
  }
  const deleteButton = event.target.closest("[data-review-delete]");
  if (deleteButton && confirm("Delete this review and its uploaded media?")) {
    try {
      await request(`/api/admin/reviews/${encodeURIComponent(deleteButton.dataset.reviewDelete)}`, { method: "DELETE" });
      await loadAdminReviews();
    } catch (error) {
      $("#adminReviewMessage").textContent = error.message;
    }
  }
});
if (token) showDashboard();
