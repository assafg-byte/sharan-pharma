# Sharan Pharma (`sharan-pharma`)

Web application for the Sharan pharma division — one home page, three platforms:

- **Mounjaro customer call center** — shifts, attendance, tasks, learning campus (login required)
- **Lilly PSP** — Omvoh / Ebglyss support-program guide (`/psp`)
- **GSK Nucala** — interactive call script (`/nucala`)

Next.js 16 · React 19 · TypeScript · Prisma + SQLite/Turso · NextAuth.

```bash
npm install
cp .env.example .env.local        # set NEXTAUTH_SECRET (openssl rand -base64 32)
npx tsx scripts/run-build-migrations.ts
npm run dev                       # http://localhost:3000
```

Documentation: [`document.md`](document.md) (technical document) · [`HANDOVER.md`](HANDOVER.md) (handover and security notes).
