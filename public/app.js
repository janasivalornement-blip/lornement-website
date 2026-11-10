const collectionCards = [
	{ name: "American Diamond", photo: "photo-1599643478518-a784e5dc4c8f", fallback: "ad-jewels.jpg" },
	{ name: "Gold Lookalike Items", photo: "photo-1611652022419-a9419f74343d", fallback: "covering-jewels.jpg" },
	{ name: "Rings", photo: "photo-1605100804763-247f67b3557e", fallback: "rings.jpg" },
	{ name: "Fashion Earrings", photo: "photo-1535632066927-ab7c9ab60908", fallback: "earrings.jpg" },
	{ name: "Antique Earrings", photo: "photo-1630019852942-f89202989a59", fallback: "earrings.jpg" },
	{ name: "Antique Necklace", photo: "photo-1617038220319-276d3cfab638", fallback: "necklaces.jpg" },
	{ name: "Antique Haaram", photo: "photo-1515562141207-7a88fb7ce338", fallback: "necklaces.jpg" },
	{ name: "Fashion Accessories", photo: "photo-1573408301185-9146fe634ad0", fallback: "covering-combo.jpg" },
	{ name: "Glass Bangles", photo: "photo-1611652022419-a9419f74343d", fallback: "bangles.jpg" },
	{ name: "Bridal sets", photo: "photo-1599643477877-530eb83abc8e", fallback: "all-items.jpg" },
	{ name: "All pieces", category: "All Items", photo: "photo-1529139574466-a303027c1d8b", fallback: "all-items.jpg" }
];
const sharedCartId = location.pathname.match(/^\/cart\/([a-f0-9]{16,64})$/)?.[1] || "";
const state = { products: [], categories: [], categoryGroups: [], categoryImages: {}, shop: {}, category: "", categoryGroupFilter: null, selectedGroup: "", searchQuery: "", sort: "featured", cart: JSON.parse(localStorage.getItem("lornement-cart") || "[]"), cartId: sharedCartId || localStorage.getItem("lornement-cart-id") || "", customer: JSON.parse(localStorage.getItem("lornement-customer") || "{}"), detail: null, detailImages: [], detailImageIndex: 0, reviews: [], reviewIndex: 0 };
const $ = selector => document.querySelector(selector);
const money = value => `₹${Number(value).toLocaleString("en-IN")}`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
async function loadCatalog() { const response = await fetch("/api/catalog"); const catalog = await response.json(); state.products = catalog.products || []; state.categories = catalog.categories || []; state.categoryGroups = catalog.categoryGroups || []; state.categoryImages = catalog.categoryImages || {}; state.shop = catalog.shop || {}; if (catalog.heroImage) $("#heroImage").src = catalog.heroImage; state.cart = state.cart.map(enrichCartItem); renderCategoryNav(); if (sharedCartId) { const cartResponse = await fetch(`/api/cart/${sharedCartId}`); if (cartResponse.ok) { const shared = await cartResponse.json(); state.cart = (shared.items || []).map(enrichCartItem); state.customer = shared.customer || {}; localStorage.setItem("lornement-cart", JSON.stringify(state.cart)); localStorage.setItem("lornement-customer", JSON.stringify(state.customer)); setSharedMode(true); renderSharedCart(); } else { showCategoryHome(); } } else { state.category = state.categories[0] || ""; await ensureCart(); renderCategoryThumbnails(); renderCategoryTiles(); renderFeaturedProducts(); } renderCart(); }
function categoryGroups() {
	const groups = state.categoryGroups.filter(group => group && typeof group.name === "string" && Array.isArray(group.categories));
	const groupedCategories = new Set(groups.flatMap(group => group.categories));
	return [...groups, ...state.categories.filter(category => !groupedCategories.has(category)).map(category => ({ name: category, categories: [category] }))];
}
function renderCategoryNav() {
	const groups = categoryGroups();
	const selectedGroup = groups.find(group => group.name === state.selectedGroup);
	$("#collectionNavInner").innerHTML = selectedGroup
		? `<button class="collection-nav-back" data-category-groups-back type="button">← All categories</button>${selectedGroup.categories.map(category => `<button data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}`
		: groups.map(group => `<button data-category-group="${escapeHtml(group.name)}">${escapeHtml(group.name)}</button>`).join("");
}
async function ensureCart() { if (state.cartId) { const existing = await fetch(`/api/cart/${state.cartId}`); if (existing.ok) return; state.cartId = ""; } const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: state.cart, customer: state.customer }) }); if (response.ok) { const cart = await response.json(); state.cartId = cart.id; localStorage.setItem("lornement-cart-id", state.cartId); } }
function categoryImage(category) {
	if (state.categoryImages[category]) return state.categoryImages[category];
	const card = collectionCards.find(item => item.name.toLowerCase() === category.toLowerCase() || item.category?.toLowerCase() === category.toLowerCase());
	if (card) return `https://images.unsplash.com/${card.photo}?auto=format&fit=crop&w=900&q=85`;
	const value = category.toLowerCase();
	const fallback = value.includes("earring") ? "earrings.jpg"
		: value.includes("necklace") || value.includes("haar") || value.includes("haram") ? "necklaces.jpg"
			: value.includes("bangle") || value.includes("bracelet") ? "bangles.jpg"
				: value.includes("ring") ? "rings.jpg"
					: value.includes("accessor") ? "covering-combo.jpg"
						: value.includes("bridal") ? "all-items.jpg"
							: "ad-jewels.jpg";
	const photo = value.includes("earring") ? "photo-1535632066927-ab7c9ab60908"
		: value.includes("necklace") || value.includes("haar") || value.includes("haram") ? "photo-1617038220319-276d3cfab638"
			: value.includes("bangle") || value.includes("bracelet") ? "photo-1611652022419-a9419f74343d"
				: value.includes("ring") ? "photo-1605100804763-247f67b3557e"
					: value.includes("bridal") ? "photo-1599643477877-530eb83abc8e"
						: value.includes("anklet") ? "photo-1611652022419-a9419f74343d"
							: "photo-1599643478518-a784e5dc4c8f";
	return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=85`;
}
function categoryThumbnailImage(category) {
	const image = categoryImage(category);
	if (!image.startsWith("https://images.unsplash.com/")) return image;
	const url = new URL(image);
	url.searchParams.set("w", "360");
	url.searchParams.set("q", "70");
	return url.toString();
}
function productImage(product) {
	const image = product.images?.[0];
	if (image && !image.startsWith("data:")) return image;
	const category = String(product.category || "").toLowerCase();
	return category.includes("earring") ? "/category-images/earrings.jpg"
		: category.includes("necklace") || category.includes("haar") ? "/category-images/necklaces.jpg"
			: category.includes("bangle") || category.includes("bracelet") ? "/category-images/bangles.jpg"
				: category.includes("ring") ? "/category-images/rings.jpg"
					: "/category-images/all-items.jpg";
}
function productImages(product) {
	const images = Array.isArray(product.images)
		? product.images.filter(image => typeof image === "string" && image.trim() && !image.startsWith("data:"))
		: [];
	return images.length ? images : [productImage(product)];
}
function categoryImageFallback(category) {
	const value = category.toLowerCase();
	return `/category-images/${value.includes("earring") ? "earrings.jpg"
		: value.includes("necklace") || value.includes("haar") || value.includes("haram") ? "necklaces.jpg"
			: value.includes("bangle") || value.includes("bracelet") ? "bangles.jpg"
				: value.includes("ring") ? "rings.jpg"
					: value.includes("accessor") ? "covering-combo.jpg"
						: value.includes("bridal") ? "all-items.jpg"
							: "ad-jewels.jpg"}`;
}
function cartProduct(item) {
	return state.products.find(product => String(product.id) === String(item.id));
}
function enrichCartItem(item) {
	const product = cartProduct(item);
	const savedPrice = item.price !== null && item.price !== "" && Number.isFinite(Number(item.price))
		? Number(item.price)
		: Number.isFinite(Number(product?.price)) ? Number(product.price) : undefined;
	return {
		...item,
		id: String(item.id),
		name: item.name || product?.name,
		code: item.code || product?.code,
		category: item.category || product?.category,
		price: savedPrice
	};
}
function cartItemPrice(item) {
	const savedPrice = item.price !== null && item.price !== "" && Number.isFinite(Number(item.price))
		? Number(item.price)
		: Number(cartProduct(item)?.price);
	return Number.isFinite(savedPrice) && savedPrice >= 0 ? savedPrice : null;
}
function renderCategoryTiles() {
	$("#categoryTiles").innerHTML = collectionCards.map((card, index) => {
		const category = card.category || card.name;
		const fallback = `/category-images/${card.fallback}`;
		return `<button class="category-tile tile-${index % 4}" data-category="${escapeHtml(category)}"><img src="${escapeHtml(categoryImage(card.name))}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" /><strong>${escapeHtml(card.name)}</strong></button>`;
	}).join("");
}
function renderCategoryThumbnails() {
	const selectedGroup = categoryGroups().find(group => group.name === state.selectedGroup);
	if (!selectedGroup) {
		$("#categoryThumbHeading").innerHTML = `<p class="eyebrow">SHOP BY CATEGORY</p><h2>Find your <em>favourite.</em></h2>`;
		$("#categoryThumbs").innerHTML = categoryGroups().map((group, index) => `<button class="category-thumb" data-category-group-products="${escapeHtml(group.name)}"><span><img src="${escapeHtml(categoryThumbnailImage(group.name))}" alt="" loading="${index < 4 ? "eager" : "lazy"}" fetchpriority="${index < 2 ? "high" : "auto"}" decoding="async" onerror="this.onerror=null;this.src='${categoryImageFallback(group.name)}'" /></span><strong>${escapeHtml(group.name)}</strong></button>`).join("");
		return;
	}
	$("#categoryThumbHeading").innerHTML = `<button class="category-thumb-back" data-category-groups-back type="button">← All categories</button><div><p class="eyebrow">${escapeHtml(selectedGroup.name)}</p><h2>Explore the <em>collection.</em></h2></div>`;
	$("#categoryThumbs").innerHTML = selectedGroup.categories.map((category, index) => `<button class="category-thumb" data-category="${escapeHtml(category)}"><span><img src="${escapeHtml(categoryThumbnailImage(category))}" alt="" loading="${index < 4 ? "eager" : "lazy"}" fetchpriority="${index < 2 ? "high" : "auto"}" decoding="async" onerror="this.onerror=null;this.src='${categoryImageFallback(category)}'" /></span><strong>${escapeHtml(category)}</strong></button>`).join("");
}
function selectCategoryGroup(name) {
	const group = categoryGroups().find(item => item.name === name);
	if (!group) return;
	state.selectedGroup = group.name;
	$("#categoryHome").hidden = true;
	$(".category-thumb-rail").hidden = false;
	renderCategoryNav();
	renderCategoryThumbnails();
}
function showCategoryGroupProducts(name) {
	const group = categoryGroups().find(item => item.name === name);
	if (!group) return;
	state.selectedGroup = group.name;
	renderCategoryNav();
	renderCategoryThumbnails();
	showProductPage(group.name, group.categories);
}
let reviewAutoplayTimer;
function renderReviews(direction = 1) {
	const target = $("#reviewList");
	if (!state.reviews.length) {
		target.innerHTML = `<p class="review-empty">Your story could be the first one here. Share a little love with us.</p>`;
		$("#reviewCarouselControls").hidden = true;
		return;
	}
	state.reviewIndex = (state.reviewIndex + state.reviews.length) % state.reviews.length;
	const review = state.reviews[state.reviewIndex];
	const mediaItems = review.media || [];
	const media = mediaItems.map(item => item.type.startsWith("video/")
			? `<video controls preload="metadata" src="${escapeHtml(item.url)}" aria-label="Video review from ${escapeHtml(review.name)}"></video>`
			: `<img src="${escapeHtml(item.url)}" alt="Photo shared by ${escapeHtml(review.name)}" loading="lazy" />`).join("");
	target.innerHTML = `<article class="customer-review ${media ? "customer-review--with-media" : "customer-review--text-only"} review-slide-${direction < 0 ? "previous" : "next"}">${media ? `<div class="customer-review-media ${mediaItems.length > 1 ? "customer-review-media--multiple" : ""}">${media}</div>` : `<div class="review-quote-mark" aria-hidden="true">“</div>`}<div class="review-card-copy"><div class="review-stars" aria-label="${review.rating} out of 5 stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div><blockquote>${escapeHtml(review.text)}</blockquote><p class="review-author">${escapeHtml(review.name)} <span>· ${new Date(review.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></p></div></article>`;
	$("#reviewPosition").textContent = `${state.reviewIndex + 1} / ${state.reviews.length}`;
	$("#reviewCarouselControls").hidden = state.reviews.length < 2;
	$("#reviewSwipeHint").hidden = state.reviews.length < 2;
}
function moveReview(direction, manual = false) {
	if (state.reviews.length < 2) return;
	state.reviewIndex = (state.reviewIndex + direction + state.reviews.length) % state.reviews.length;
	renderReviews(direction);
	clearInterval(reviewAutoplayTimer);
	if (!manual) reviewAutoplayTimer = setInterval(() => moveReview(1), 3000);
}
async function loadReviews() {
	const target = $("#reviewList");
	try {
		const response = await fetch("/api/reviews");
		if (!response.ok) throw new Error("Reviews are temporarily unavailable.");
		state.reviews = (await response.json()).sort((first, second) =>
			(Date.parse(second.createdAt) || 0) - (Date.parse(first.createdAt) || 0)
		);
		renderReviews();
		clearInterval(reviewAutoplayTimer);
		if (state.reviews.length > 1) {
			reviewAutoplayTimer = setInterval(() => moveReview(1), 3000);
		}
	} catch (error) {
		target.innerHTML = `<p class="review-empty">${escapeHtml(error.message)}</p>`;
	}
}
function readMediaFiles(files) {
	return Promise.all([...files].map(file => new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
		reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
		reader.readAsDataURL(file);
	})));
}
async function submitPublicReview(event) {
	event.preventDefault();
	const form = event.currentTarget;
	const button = form.querySelector('button[type="submit"]');
	const message = $("#publicReviewMessage");
	const files = form.elements.media.files;
	if (files.length > 4) {
		message.textContent = "Choose no more than 4 photos or videos.";
		return;
	}
	if ([...files].some(file => file.type.startsWith("image/") && file.size > 6 * 1024 * 1024 || file.type.startsWith("video/") && file.size > 18 * 1024 * 1024)) {
		message.textContent = "Each photo must be under 6 MB and each video under 18 MB.";
		return;
	}
	if ([...files].reduce((total, file) => total + file.size, 0) > 24 * 1024 * 1024) {
		message.textContent = "All review files together must be under 24 MB.";
		return;
	}
	button.disabled = true;
	message.textContent = "Sending your review…";
	try {
		const media = await readMediaFiles(files);
		const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.elements.name.value, rating: form.elements.rating.value, text: form.elements.text.value, media }) });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Could not send your review.");
		form.reset();
		message.textContent = result.message;
	} catch (error) {
		message.textContent = error.message || "Could not send your review.";
	} finally {
		button.disabled = false;
	}
}
function renderFeaturedProducts() {
	$("#featuredProducts").innerHTML = state.products.slice(0, 8).map(product => {
		const image = productImage(product);
		return `<article class="featured-card"><button class="featured-image" data-detail="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='/category-images/all-items.jpg'" /><span>VIEW PIECE ↗</span></button><div class="featured-card-copy"><div><p>${escapeHtml(product.category)}</p><h3>${escapeHtml(product.name)}</h3><strong>${money(product.price)}</strong></div><button class="featured-add" data-feature-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to bag">+</button></div></article>`;
	}).join("");
}
function matchesCategory(product, category) {
	const categoryName = String(product.category || "").toLowerCase();
	const productName = String(product.name || "").toLowerCase();
	const value = `${categoryName} ${productName}`;
	const selected = String(category).toLowerCase();
	if (["all", "all items", "all pieces"].includes(selected)) return true;
	const aliases = {
		"american diamond": ["american diamond", "ad jewels", "ad necklace", "diamond"],
		"gold lookalike items": ["gold lookalike", "gold look alike", "gold tone", "imitation gold"],
		"fashion earrings": ["fashion earrings", "earrings", "earring"],
		"antique earrings": ["antique earrings", "antique earring"],
		"antique necklace": ["antique necklace", "antique haaram", "antique haram"],
		"antique haaram": ["antique haaram", "antique haram", "antique necklace"],
		"fashion accessories": ["fashion accessories", "accessories"],
		"glass bangles": ["glass bangles", "bangles", "bracelets", "bracelet"],
		"bridal sets": ["bridal sets", "bridal set", "bridal"]
	};
	if (selected === "rings") return /\brings?\b/.test(value);
	const terms = aliases[selected] || [selected];
	if (terms.some(term => categoryName.includes(term))) return true;
	if (selected === "fashion earrings") return value.includes("earring") && !value.includes("antique");
	if (selected === "antique earrings") return value.includes("antique") && value.includes("earring");
	if (selected === "antique necklace" || selected === "antique haaram") return value.includes("antique") && (value.includes("necklace") || value.includes("haar") || value.includes("haram"));
	if (selected === "fashion accessories") return ["earring", "necklace", "bangle", "bracelet", "ring", "accessory"].some(term => value.includes(term)) && !value.includes("bridal");
	if (selected === "bridal sets") return value.includes("bridal");
	return terms.some(term => value.includes(term));
}
function visibleProducts() {
	const query = state.searchQuery.trim().toLowerCase();
	let products = query
		? state.products.filter(product => `${product.name || ""} ${product.code || ""}`.toLowerCase().includes(query))
		: state.products.filter(product => state.categoryGroupFilter
			? state.categoryGroupFilter.some(category => matchesCategory(product, category))
			: matchesCategory(product, state.category));
	if (state.sort === "low") products.sort((a,b) => a.price - b.price);
	if (state.sort === "high") products.sort((a,b) => b.price - a.price);
	return products;
}
function updateProductSearch(value) {
	state.searchQuery = value.trim();
	state.categoryGroupFilter = null;
	$(".category-thumb-rail").hidden = true;
	$("#clearProductSearch").hidden = !state.searchQuery;
	if (!state.searchQuery) {
		showCategoryHome();
		return;
	}
	setSharedMode(false);
	$("#sharedCartPage").hidden = true;
	$("#categoryHome").hidden = true;
	$("#shop").hidden = false;
	$(".category-thumb-rail").hidden = true;
	$(".shop-page-heading").hidden = false;
	$("#shopTitle").textContent = `Results for "${state.searchQuery}"`;
	renderProducts();
}
function clearProductSearch() {
	$("#productSearchInput").value = "";
	updateProductSearch("");
}
function showProductPage(category, groupCategories = null) {
	state.searchQuery = "";
	state.categoryGroupFilter = groupCategories;
	$(".category-thumb-rail").hidden = !state.selectedGroup;
	$("#productSearchInput").value = "";
	$("#clearProductSearch").hidden = true;
	state.category = category;
	$("#categoryHome").hidden = true;
	$("#shop").hidden = false;
	$(".shop-page-heading").hidden = Boolean(state.selectedGroup);
	$("#shopTitle").textContent = category;
	$("#productSummary").textContent = `${category} · loading pieces...`;
	window.scrollTo({ top: 0, behavior: "smooth" });
	renderProducts();
}
function setSharedMode(active) { $(".promise-strip").hidden = active; $(".visit-section").hidden = active; $(".reviews-section").hidden = active; $(".category-thumb-rail").hidden = active; $(".product-search-strip").hidden = active; $("body").classList.toggle("shared-cart-mode", active); }
function showCategoryHome() { setSharedMode(false); $(".category-thumb-rail").hidden = false; state.searchQuery = ""; state.categoryGroupFilter = null; $("#productSearchInput").value = ""; $("#clearProductSearch").hidden = true; $("#sharedCartPage").hidden = true; $("#shop").hidden = true; $("#categoryHome").hidden = false; state.selectedGroup = ""; renderCategoryNav(); renderCategoryThumbnails(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function renderProducts() {
	const products = visibleProducts();
	const query = state.searchQuery.trim();
	$("#productSummary").textContent = query
		? `${products.length} ${products.length === 1 ? "match" : "matches"} for "${query}"`
		: `${products.length} ${products.length === 1 ? "piece" : "pieces"}`;
	$("#emptyState").hidden = products.length > 0;
	if (query) {
		$("#emptyTitle").textContent = "No matching pieces";
		$("#emptyMessage").textContent = "Try another product name or code.";
		$("#emptyHome").textContent = "Clear search";
	} else {
		$("#emptyTitle").textContent = "Coming soon";
		$("#emptyMessage").textContent = "We are adding pieces to this edit.";
		$("#emptyHome").textContent = "Back to categories";
	}
	$("#productGrid").innerHTML = products.map(product => `<article class="product-card"><button class="product-image" data-detail="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.name)}"><img loading="lazy" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='/category-images/all-items.jpg'" /><span class="zoom-badge" aria-hidden="true">⌕</span></button><div class="product-info"><p class="product-category">${escapeHtml(product.category)} · Code ${escapeHtml(product.code || "")}</p><h3 class="product-name">${escapeHtml(product.name)}</h3><div class="product-bottom"><span class="price">${money(product.price)}</span><button class="add-button" data-add="${escapeHtml(product.id)}">+ Add to bag</button></div></div></article>`).join("");
}
function renderSharedCart() {
	$("#sharedCartPage").hidden = false;
	$("#categoryHome").hidden = true;
	$("#shop").hidden = true;
	$("#sharedCartId").textContent = `ORD-${sharedCartId.slice(0, 12).toUpperCase()}`;
	const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
	$("#sharedCartCount").textContent = `${totalCount} item${totalCount === 1 ? "" : "s"}`;
	$("#sharedCartItems").innerHTML = state.cart.map(item => {
		const product = cartProduct(item);
		const name = item.name || product?.name || "Product no longer available";
		const code = item.code || product?.code || item.id || "N/A";
		const category = item.category || product?.category || "";
		const price = cartItemPrice(item);
		const image = product?.images?.[0] || categoryImageFallback(category);
		return `<div class="shared-item"><img src="${escapeHtml(image)}" alt="${escapeHtml(name)}"/><div class="shared-item-info"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(category)}${category ? " · " : ""}Code: ${escapeHtml(code)} · ${price === null ? "Price to be confirmed" : `${money(price)} each`}</small><span>${item.quantity} × ${price === null ? "Price to be confirmed" : money(price)} <b>${price === null ? "To be confirmed" : money(price * item.quantity)}</b></span></div></div>`;
	}).join("") || `<p class="shared-empty">This cart is empty.</p>`;
	const customerDetails = [["Name", state.customer.name], ["Mobile", state.customer.mobile], ["Address", state.customer.address]]
		.filter(([, value]) => value)
		.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value).replace(/\n/g, "<br />")}</p>`)
		.join("");
	$("#sharedCustomer").innerHTML = customerDetails ? `<p class="eyebrow">CUSTOMER DETAILS</p>${customerDetails}` : "";
	const total = cartTotal();
	$("#sharedCartTotal").textContent = state.cart.some(item => cartItemPrice(item) === null)
		? `${money(total)} + prices to be confirmed`
		: money(total);
}
async function saveCart() { state.cart = state.cart.map(enrichCartItem); localStorage.setItem("lornement-cart", JSON.stringify(state.cart)); renderCart(); await ensureCart(); if (state.cartId) fetch(`/api/cart/${state.cartId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: state.cart, customer: state.customer }) }).catch(() => {}); }
function addToCart(id) { const product = state.products.find(item => String(item.id) === String(id)); if (!product) return; const current = state.cart.find(item => String(item.id) === String(id)); if (current) { current.quantity++; Object.assign(current, enrichCartItem({ ...current, id: String(product.id), quantity: current.quantity, name: product.name, code: product.code, category: product.category, price: product.price })); } else { state.cart.push(enrichCartItem({ id: String(product.id), quantity: 1, name: product.name, code: product.code, category: product.category, price: product.price })); } saveCart(); openCart(); }
function cartTotal() { return state.cart.reduce((sum, item) => { const price = cartItemPrice(item); return sum + (price === null ? 0 : price * item.quantity); }, 0); }
function renderCart() { const count = state.cart.reduce((sum, item) => sum + item.quantity, 0); $("#cartCount").textContent = count; $("#drawerCount").textContent = count; $("#cartTotal").textContent = state.cart.some(item => cartItemPrice(item) === null) ? `${money(cartTotal())} + prices to be confirmed` : money(cartTotal()); $("#cartItems").innerHTML = state.cart.length ? state.cart.map(item => { const product = cartProduct(item); const name = item.name || product?.name || "Product no longer available"; const price = cartItemPrice(item); return `<div class="cart-item"><img src="${escapeHtml(product?.images?.[0] || categoryImageFallback(item.category || ""))}" alt="" /><div><h4>${escapeHtml(name)}</h4><p>${price === null ? "Price to be confirmed" : money(price)}</p><div class="quantity"><button data-quantity="${escapeHtml(item.id)}" data-change="-1">−</button><span>${item.quantity}</span><button data-quantity="${escapeHtml(item.id)}" data-change="1">+</button></div></div><button class="remove-item" data-remove="${escapeHtml(item.id)}">Remove</button></div>`; }).join("") : `<div class="empty-state"><span>✦</span><h3>Your bag is waiting</h3><p>Add a few pieces and they will appear here.</p></div>`; }
function openCart() { $("#cartDrawer").classList.add("open"); $("#scrim").classList.add("open"); $("#cartDrawer").setAttribute("aria-hidden", "false"); }
function closeCart() { $("#cartDrawer").classList.remove("open"); $("#scrim").classList.remove("open"); $("#cartDrawer").setAttribute("aria-hidden", "true"); }
function resetBagAfterCheckout() {
	state.cart = [];
	state.cartId = "";
	localStorage.setItem("lornement-cart", "[]");
	localStorage.removeItem("lornement-cart-id");
	renderCart();
	closeCart();
}
function updateDetailImage() {
	const image = state.detailImages[state.detailImageIndex];
	$("#detailImage").src = image;
	$("#detailImage").alt = state.detail.name;
	$("#imageViewerPhoto").src = image;
	$("#imageViewerPhoto").alt = state.detail.name;
	const multipleImages = state.detailImages.length > 1;
	$("#detailImagePrevious").hidden = !multipleImages;
	$("#detailImageNext").hidden = !multipleImages;
	$("#viewerImagePrevious").hidden = !multipleImages;
	$("#viewerImageNext").hidden = !multipleImages;
	$("#detailImageCount").hidden = !multipleImages;
	$("#viewerImageCount").hidden = !multipleImages;
	if (multipleImages) {
		const count = `${state.detailImageIndex + 1} / ${state.detailImages.length}`;
		$("#detailImageCount").textContent = count;
		$("#viewerImageCount").textContent = count;
	}
}
function moveProductImage(direction) {
	if (state.detailImages.length < 2) return;
	state.detailImageIndex = (state.detailImageIndex + direction + state.detailImages.length) % state.detailImages.length;
	updateDetailImage();
}
function openDetail(id) { const product = state.products.find(item => String(item.id) === String(id)); if (!product) return; state.detail = product; state.detailImages = productImages(product); state.detailImageIndex = 0; updateDetailImage(); $("#enlargeProductImage").setAttribute("aria-label", `Enlarge ${product.name} image`); $("#detailCategory").textContent = product.category; $("#detailName").textContent = product.name; $("#detailPrice").textContent = money(product.price); $("#detailDescription").textContent = product.description || "A considered piece for your everyday collection."; $("#productDialog").showModal(); }
function checkout() { if (!state.cart.length) return; $("#checkoutError").textContent = ""; $("#checkoutForm").elements.name.value = state.customer.name || ""; $("#checkoutForm").elements.mobile.value = state.customer.mobile || ""; $("#checkoutForm").elements.address.value = state.customer.address || ""; $("#checkoutDialog").showModal(); }
async function submitCheckout(event) {
	event.preventDefault();
	const form = new FormData(event.target);
	state.customer = {
		name: String(form.get("name") || "").trim(),
		mobile: String(form.get("mobile") || "").trim(),
		address: String(form.get("address") || "").trim()
	};
	localStorage.setItem("lornement-customer", JSON.stringify(state.customer));
	const button = event.target.querySelector('button[type="submit"]');
	button.disabled = true;
	$("#checkoutError").textContent = "";
	try {
		const items = state.cart.map(enrichCartItem);
		const response = await fetch("/api/cart", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ items, customer: state.customer })
		});
		let savedCart;
		try {
			savedCart = await response.json();
		} catch {
			throw new Error(`Could not save the cart for sharing (HTTP ${response.status}). Please try again.`);
		}
		if (!response.ok) throw new Error(savedCart.error || `Could not save the cart for sharing (HTTP ${response.status}). Please try again.`);
		if (typeof savedCart.id !== "string" || !/^[a-f0-9]{16,64}$/.test(savedCart.id)) {
			throw new Error("The server saved the cart but did not return a valid share link. Please try again.");
		}
		state.cartId = savedCart.id;
		const lines = items.map(item => {
			const price = cartItemPrice(item);
			const name = item.name || "Product no longer available";
			const code = item.code || item.id || "N/A";
			if (price === null) return `• ${name} [Code: ${code}]\n  ${item.quantity} × price to be confirmed`;
			return `• ${name} [Code: ${code}]\n  ${item.quantity} × ${money(price)} = ${money(price * item.quantity)}`;
		});
		const cartOrigin = state.shop.publicUrl || location.origin;
		const cartBase = new URL(cartOrigin);
		const cartUrl = new URL(`/cart/${encodeURIComponent(state.cartId)}`, cartBase.origin).href;
		const orderId = `ORD-${state.cartId.slice(0, 12).toUpperCase()}`;
		const hasUnpricedItems = items.some(item => cartItemPrice(item) === null);
		const total = `${money(cartTotal())}${hasUnpricedItems ? " + prices to be confirmed" : ""}`;
		const message = `Hello L'Ornement! I'd like to place an order:\n\nOrder ID: ${orderId}\nCustomer name: ${state.customer.name}\nMobile number: ${state.customer.mobile}\nAddress: ${state.customer.address || "Not provided"}\n\n${lines.join("\n")}\n\nTotal: ${total}\n\nOpen the order cart and product catalogue:\n${cartUrl}\n\nPlease confirm availability and delivery details.`;
		const number = String(state.shop.whatsapp || "").replace(/\D/g, "");
		$("#checkoutDialog").close();
		window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
		resetBagAfterCheckout();
	} catch (error) {
		$("#checkoutError").textContent = error.message || "Could not prepare your order. Please try again.";
	} finally {
		button.disabled = false;
	}
}

document.addEventListener("click", event => { const mobileMenu = event.target.closest("#mobileMenuButton"); if (mobileMenu) { const open = mobileMenu.getAttribute("aria-expanded") !== "true"; mobileMenu.setAttribute("aria-expanded", String(open)); mobileMenu.setAttribute("aria-label", open ? "Close collections menu" : "Open collections menu"); $("#collectionNav").classList.toggle("is-open", open); return; } const category = event.target.closest("[data-category]"); if (category) { showProductPage(category.dataset.category); $("#collectionNav").classList.remove("is-open"); $("#mobileMenuButton").setAttribute("aria-expanded", "false"); $("#mobileMenuButton").setAttribute("aria-label", "Open collections menu"); } const featuredDetail = event.target.closest("[data-feature-detail]"); if (featuredDetail) openDetail(featuredDetail.dataset.featureDetail); const featuredAdd = event.target.closest("[data-feature-add]"); if (featuredAdd) addToCart(featuredAdd.dataset.featureAdd); const add = event.target.closest("[data-add]"); if (add) addToCart(add.dataset.add); const detail = event.target.closest("[data-detail]"); if (detail) openDetail(detail.dataset.detail); const remove = event.target.closest("[data-remove]"); if (remove) { state.cart = state.cart.filter(item => item.id !== remove.dataset.remove); saveCart(); } const quantity = event.target.closest("[data-quantity]"); if (quantity) { const item = state.cart.find(entry => entry.id === quantity.dataset.quantity); item.quantity = Math.max(0, item.quantity + Number(quantity.dataset.change)); state.cart = state.cart.filter(entry => entry.quantity > 0); saveCart(); } });
document.addEventListener("click", event => { const groupProducts = event.target.closest("[data-category-group-products]"); if (groupProducts) { showCategoryGroupProducts(groupProducts.dataset.categoryGroupProducts); return; } const group = event.target.closest("[data-category-group]"); if (group) { selectCategoryGroup(group.dataset.categoryGroup); return; } if (event.target.closest("[data-category-groups-back]")) showCategoryHome(); });
$("#productSearchInput").addEventListener("input", event => updateProductSearch(event.target.value));
$("#productSearchForm").addEventListener("submit", event => { event.preventDefault(); updateProductSearch($("#productSearchInput").value); });
$("#clearProductSearch").addEventListener("click", clearProductSearch);
$("#sortSelect").addEventListener("change", event => { state.sort = event.target.value; renderProducts(); }); $("#emptyHome").addEventListener("click", () => state.searchQuery ? clearProductSearch() : showCategoryHome()); $("#backToCollections").addEventListener("click", showCategoryHome); $("#cartButton").addEventListener("click", openCart); $("#closeCart").addEventListener("click", closeCart); $("#scrim").addEventListener("click", closeCart); $("#checkoutButton").addEventListener("click", checkout); $("#closeProduct").addEventListener("click", () => $("#productDialog").close()); $("#enlargeProductImage").addEventListener("click", () => $("#imageViewerDialog").showModal()); $("#detailImagePrevious").addEventListener("click", () => moveProductImage(-1)); $("#detailImageNext").addEventListener("click", () => moveProductImage(1)); $("#viewerImagePrevious").addEventListener("click", () => moveProductImage(-1)); $("#viewerImageNext").addEventListener("click", () => moveProductImage(1)); $("#closeImageViewer").addEventListener("click", () => $("#imageViewerDialog").close()); $("#imageViewerDialog").addEventListener("click", event => { if (event.target === $("#imageViewerDialog")) $("#imageViewerDialog").close(); }); $("#detailAdd").addEventListener("click", () => { addToCart(state.detail.id); $("#productDialog").close(); });
$("#imageViewerDialog").addEventListener("cancel", event => { event.preventDefault(); $("#imageViewerDialog").close(); });
document.addEventListener("keydown", event => {
	if (event.key === "Escape" && $("#imageViewerDialog").open) {
		event.preventDefault();
		$("#imageViewerDialog").close();
	}
});
$("#closeCheckout").addEventListener("click", () => $("#checkoutDialog").close()); $("#checkoutForm").addEventListener("submit", submitCheckout); $("#sharedCheckout").addEventListener("click", checkout); $("#publicReviewForm").addEventListener("submit", submitPublicReview);
$("#previousReview").addEventListener("click", () => moveReview(-1, true));
$("#nextReview").addEventListener("click", () => moveReview(1, true));
let reviewSwipeStartX = 0;
$("#reviewList").addEventListener("touchstart", event => {
	reviewSwipeStartX = event.changedTouches[0]?.screenX || 0;
}, { passive: true });
$("#reviewList").addEventListener("touchend", event => {
	const distance = (event.changedTouches[0]?.screenX || reviewSwipeStartX) - reviewSwipeStartX;
	if (Math.abs(distance) >= 45) moveReview(distance < 0 ? 1 : -1, true);
}, { passive: true });
loadReviews();
loadCatalog().catch(() => { $("#productSummary").textContent = "Catalog unavailable"; });
