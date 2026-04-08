# football-booking-system

和歌山の少年サッカークラブ向け・グラウンド予約＆空き状況確認の Web アプリ（Next.js + Supabase）。

## Supabase セットアップ

1. [Supabase ダッシュボード](https://supabase.com/dashboard) → 対象プロジェクト → **Settings** → **API**
2. **Project URL** と **anon public** キーをコピー
3. プロジェクト直下に `.env.local` を作成し、以下を記入（値を自分のものに置き換え）:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx  （または匿名キー）
   ```
   ※ 公開可能キー（sb_publishable_）でも匿名キー（anon）でも可。匿名キーは不要。
4. 開発サーバーを再起動: `npm run dev`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

### `public/` の置き場

| パス | 内容 |
|------|------|
| `public/images/brand/` | テンプレ由来の SVG ロゴなど（トップページから参照） |
| `public/dev/` | 進捗トラッカー（`progress-tracker.html` / `progress-tasks.json`） |

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
