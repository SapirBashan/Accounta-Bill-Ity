# Accounta-Bill-Ity

Accounta-Bill-Ity is a Hebrew family finance app for tracking income, expenses, budgets, household members, and yearly spending trends.

## Live App

Open the deployed app:

**[Open Accounta-Bill-Ity]([https://accountabillity.vercel.app](https://accountabillity-azure.vercel.app/)**

Deployment dashboard:

**[Open the Vercel project](https://vercel.com/sap-5fd0/accountabillity/GPxBdm8Y5fMapeBbDSsDiTKxVkon)**

## Features

- Monthly dashboard with income, spending, balance, and budget progress.
- Quick expense entry from the Add page.
- Monthly budget planning by category.
- Income tracking.
- Transaction history.
- Yearly summary with monthly charts, averages, and spending distribution.
- Drag-and-drop category ordering on desktop and mobile.
- Shared household members.
- Light and dark themes with saved preference.
- Excel import for monthly budgets and historical spending.
- Styled Excel export with monthly sheets and a working annual summary.
- Responsive layout suitable for desktop and mobile browsers.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase Authentication and PostgreSQL
- Vercel deployment
- XLSX and XLSX-JS-Style for spreadsheet import/export

## Local Development

### Requirements

- Node.js 20 or newer
- npm
- A Supabase project

### Install

```bash
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Never commit `.env.local` or a Supabase service-role key.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Setup

The database migrations are stored in `supabase/migrations`.

With the Supabase CLI linked to the project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migrations create and configure categories, monthly budgets, transactions, user preferences, shared household members, household access functions, security policies, and realtime membership updates.

## Verification Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run the production server after building:

```bash
npm start
```

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Monthly dashboard |
| `/add` | Quick expense entry |
| `/budget` | Monthly budget planning and category management |
| `/income` | Income tracking |
| `/history` | Transaction history |
| `/summary` | Yearly summary and charts |
| `/settings` | Account, household, theme, import, and export settings |
| `/login` | Authentication |

## Excel Import and Export

Excel tools are available in **Settings**.

### Import

The importer accepts `.xlsx` files containing monthly budget sheets. It imports expense categories, monthly budget targets, monthly spending totals, and income totals.

The yearless December sheet is treated as December 2025. If March is missing, March should be copied from February before import.

Imported transactions are marked with `ייבוא XLSX:` so repeated imports can replace previous imported records without creating duplicates.

### Export

The export creates a formatted workbook containing one sheet per month, fixed expenses, variable expenses, budget and actual spending, remaining balances, income, savings, and a yearly summary with working formulas and monthly averages.

## Deployment

The project is connected to GitHub and Vercel. Pushes to the `main` branch trigger a new Vercel deployment:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

Configure these Vercel environment variables for Production, Preview, and Development:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

After deployment, configure Supabase Auth:

1. Open **Supabase → Authentication → URL Configuration**.
2. Set the Site URL to the deployed app URL.
3. Add the deployed app URL to the allowed redirect URLs.
4. Add the callback URL:

```text
https://accountabillity.vercel.app/auth/callback
```

Never expose a Supabase service-role key in client code or public environment variables.

## Mobile Use

The responsive web app can be used on a phone immediately:

1. Open the live app in Safari or Chrome.
2. Use **Add to Home Screen** or **Install app**.
3. Launch Accounta-Bill-Ity from the phone home screen.

The app requires an internet connection because authentication and database operations run through Supabase.

## Project Structure

```text
src/
	actions/       Server actions for budgets, members, data, and transactions
	app/           Next.js routes and pages
	components/   Shared UI components
	lib/           Supabase, household, category, and utility helpers
	types/         Shared TypeScript types
supabase/
	migrations/   Database schema and security migrations
public/          Static assets and web manifest
```

## License

This project is private and intended for its household users.
