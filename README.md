# L'Ornement Fashion Jewels

A standalone mobile-first jewelry storefront with an owner admin panel and WhatsApp checkout.

## Run locally

```powershell
cd C:\siva\lornement-website
$env:STOREFRONT_ADMIN_PASSWORD = "choose-a-password"
$env:STORE_WHATSAPP_NUMBER = "919876543210"
$env:STOREFRONT_PUBLIC_URL = "https://your-public-store-domain.example"
npm start
```

Open `http://localhost:5050/` when using `npm start`.

## Windows start, stop, and startup

The PowerShell scripts run the website on port `6754`. From the repository directory:

```powershell
.\scripts\start.ps1
.\scripts\status.ps1
.\scripts\stop.ps1
```

To start the website automatically after a restart, install startup integration:

```powershell
.\scripts\install-startup.ps1
```

When run from an Administrator PowerShell, this registers a Task Scheduler task that runs 30 seconds after Windows boots, including before sign-in. Without administrator rights, it installs a shortcut in the current user's Startup folder, which starts the website when that user signs in. Both methods start the website in the background and support running on battery. `scripts\stop.ps1` stops only the website; automatic startup stays enabled. To disable automatic startup, run `.\scripts\remove-startup.ps1`. The site will remain running until separately stopped.

The startup task uses persistent Windows user or system environment variables. Set `STOREFRONT_ADMIN_PASSWORD`, `STORE_WHATSAPP_NUMBER`, and `STOREFRONT_PUBLIC_URL` in Windows Environment Variables if you need custom values; values set only in a PowerShell window do not survive a reboot. The Cloudflare Tunnel is a separate Windows service and must also be configured for automatic startup for the public domain to remain reachable.

The admin page is at `http://localhost:5050/admin`. Upload up to eight product images directly in the admin form. Catalog data is stored in `data/catalog.json`.

Set `STOREFRONT_PUBLIC_URL` to the deployed HTTPS storefront domain so WhatsApp cart links open for customers and admins outside the local network. When this is unset, checkout still shares the order using the current site origin. If that origin is localhost or a private-network address, its cart link only works on that computer or network; deployment is required for links to work from other locations.

The owner dashboard organizes product categories into parent groups and subcategories. Add products with the grouped category selector; use Edit on any catalogue card to change its details. Existing photos are kept unless replacement photos are selected. Category names can be renamed, moved between groups, or assigned an image from the Categories panel.

The storefront hero image can be changed from the Storefront visuals panel in the owner dashboard. The Our Story section uses `public/our-story.jpg`.

Uploaded product and category images are resized to at most 1600 pixels and JPEG-compressed in the owner dashboard, then stored separately from the catalog in `public/product-images/`. Back up that directory along with `data/catalog.json`. On the first server request after upgrading, any older images embedded in `data/catalog.json` are moved to image files automatically. Those image URLs are content-hashed and cached by browsers, so repeat visits do not download them again. Existing image files have also been converted to WebP or optimized JPEG to reduce page transfers.

Customer reviews are stored separately in `data/reviews.json`. Public submissions remain pending until approved in the Reviews section of the owner dashboard. Reviews can include up to four JPG, PNG, or WebP photos and one MP4, WebM, or MOV video; photos are limited to 6 MB each, videos to 18 MB, and all review media to 24 MB total. Uploaded media is served from `public/review-media/`.
