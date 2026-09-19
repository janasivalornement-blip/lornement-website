# L'Ornement Fashion Jewels

A standalone mobile-first jewelry storefront with an owner admin panel and WhatsApp checkout.

## Run locally

```powershell
cd C:\siva\lornement-website
$env:STOREFRONT_ADMIN_PASSWORD = "choose-a-password"
$env:STORE_WHATSAPP_NUMBER = "919876543210"
npm start
```

Open `http://localhost:5050/`.

The admin page is at `http://localhost:5050/admin`. Product images can be added as image URLs or uploaded directly in the admin form. Data is stored in `data/catalog.json`.
