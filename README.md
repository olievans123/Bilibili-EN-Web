# Bilibili EN - Web Version

**[Live Demo: bilibili-en-web.vercel.app](https://bilibili-en-web.vercel.app)**

Browse Bilibili with English translations - no download required.

## Features

- Browse trending/top videos
- Search in English or Chinese
- Automatic translation of titles and comments
- Category browsing
- Video playback with comments
- Local favorites, history and playlists (stored in browser)
- Mobile responsive

## Desktop App

For the full-featured desktop app with sign-in and downloads, see [Bilibili-EN](https://github.com/olievans123/Bilibili-EN/releases/latest).

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/olievans123/Bilibili-EN-Web)

Or manually:

```bash
npm install
npm run build
vercel --prod
```

## Local Development

```bash
npm install
npm run dev
```

## How It Works

The web version uses Vercel Serverless Functions to proxy requests to Bilibili's API, bypassing CORS restrictions. Translation is handled via Google Translate API.
