# Choco Choo Modern Restaurant Website & Menu Manager

A premium, fast, and fully responsive restaurant website built for **Choco Choo** featuring an elegant dark-chocolate themed menu, a customer shopping cart draft tool, a dedicated mobile-first table QR menu, and a secure admin dashboard.

## Tech Stack
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Vanilla CSS (CSS Modules & Custom HSL design tokens in `globals.css`)
* **Authentication:** JWT tokens via secure HTTP-Only cookies (`jose` library)
* **Database Layer:** Dual persistence system:
  * **Local Development (Default):** Local JSON storage (`src/data/menu.json` and `src/data/settings.json`).
  * **Production (Vercel, Netlify, Cloudflare Pages):** Transparently connects to a Supabase project when environment variables are defined.

---

## Features
1. **Premium Responsive Menu:** Grouped by categories with horizontal scroll highlights and smooth scroll tab navigation.
2. **Local Cart Drafting:** Lets table-bound customers select and review desserts before heading to the ordering counter.
3. **Dedicated QR Table Menu (`/menu-qr`):** An ultra-lightweight, mobile-first view of the menu designed for table QR scans, focusing purely on item lists, descriptions, and prices.
4. **Protected Admin Panel (`/admin`):** Secure dashboard to:
   * Add, edit, hide, delete, or reorder products.
   * Add, rename, delete, or reorder categories.
   * Manage store hours, announcement banners, hero landing text, addresses, phones, and social links.

---

## 🛠️ Local Development & Setup

### 1. Install Dependencies
Ensure you have Node.js (v18+) and npm installed. Run:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the template variables file:
```bash
cp .env.example .env
```
Open `.env` and set:
* `ADMIN_PASSWORD` (Your desired admin panel password. Defaults to `change-this-password` if left empty).
* `JWT_SECRET` (A unique random string for signing secure admin sessions).

### 3. Run Locally
Start the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the homepage.
Open [http://localhost:3000/menu-qr](http://localhost:3000/menu-qr) to view the QR menu.
Open [http://localhost:3000/admin](http://localhost:3000/admin) to log in to the management dashboard.

---

## 💾 Production Database Setup (Supabase)

For serverless deployments (where local filesystem writes are temporary or read-only), configure a free Supabase instance:

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project.
3. Open the **SQL Editor** in the Supabase dashboard and run the following command to create the store table:
   ```sql
   create table choco_store (
     key text primary key,
     value jsonb
   );
   ```
4. Copy your project settings:
   * Go to **Project Settings** > **API**.
   * Copy the **Project URL** and paste it as `SUPABASE_URL` in your env.
   * Copy the **service_role** API key (do NOT use the `anon` key, as the server needs write permissions) and paste it as `SUPABASE_SERVICE_ROLE_KEY` in your env.
5. Save the environment variables. The application will automatically detect them, seed the database with the initial Czech menu, and persist all admin operations.

---

## 🚀 Deploying the Site

### Deploying to Vercel or Netlify
1. Push your repository to GitHub.
2. Link your repository in Vercel or Netlify.
3. Set your environment variables in the project settings panel:
   * `ADMIN_PASSWORD`
   * `JWT_SECRET`
   * `SUPABASE_URL` (optional but recommended)
   * `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)
4. Trigger the build and deploy.

### Deploying to Cloudflare Pages
1. Install the Cloudflare Pages adapter compatibility if needed, or build as a standard Next.js project. Next.js App Router builds can be compiled for Cloudflare using `@cloudflare/next-on-pages`:
   ```bash
   npx @cloudflare/next-on-pages
   ```
2. Configure the build settings in Cloudflare Pages dashboard:
   * **Framework preset:** Next.js
   * **Build command:** `npx @cloudflare/next-on-pages` (or standard `npm run build` if utilizing standard serverless functions)
   * **Output directory:** `.vercel/output` (or `.next` depending on the build type)
3. Under **Settings** > **Environment variables**, define your production values.

---

## 🔗 Custom Domains & QR Code Generation

### Connecting a Custom Domain
1. In your hosting platform (Vercel, Cloudflare, or Netlify), navigate to **Domains**.
2. Add your custom domain (e.g. `chocochoo.cz`).
3. Follow the instructions to configure your DNS provider (pointing an `A` record to the host IP or setting a `CNAME` pointing to the host domain).

### Generating Table QR Codes
Once the website is live (e.g., `https://chocochoo.cz`):
1. Navigate to [https://chocochoo.cz/menu-qr](https://chocochoo.cz/menu-qr) on your computer.
2. Use any QR Code generator (such as [qr-code-generator.com](https://www.qr-code-generator.com/) or direct Chrome "Create QR Code" tool).
3. Generate the QR code pointing directly to `https://chocochoo.cz/menu-qr`.
4. Print the QR code and attach it to tables. When scanned, customers will land directly on the mobile-first menu.
