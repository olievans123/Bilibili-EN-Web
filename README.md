# Bilibili EN - Web Version

Browse Bilibili with English translations. This is the web version that runs on Vercel.

## Features

- Browse trending videos
- Search in English or Chinese
- Automatic translation of titles and comments
- View channels and video details
- Local history and playlists (stored in browser)

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/Bilibili-EN-Web)

Or manually:

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Deploy (settings auto-detected from `vercel.json`)

## Local Development

```bash
npm install
npm run dev
```

## How It Works

The web version uses Vercel Edge Functions to proxy requests to Bilibili's API, bypassing CORS restrictions. Translation is handled via Google Translate's unofficial API.

## Desktop Version

For the full-featured desktop app (with downloads), see [Bilibili-EN](https://github.com/olievans123/Bilibili-EN).
