# R2 Image Browser

A Cloudflare Workers-based web application for browsing image collections stored in R2 buckets with click-to-copy functionality.

## Features

- Browse images organized by folders/collections
- Visual grid layout with thumbnails
- Click any image to copy its public URL to clipboard
- Responsive design that works on mobile and desktop
- Leverages Cloudflare edge caching for fast image delivery
- Built with Vue 3 and PrimeVue components

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Cloudflare account with R2 enabled
- An R2 bucket with images organized in folders

### Installation

1. Clone this repository:
```bash
cd r2-image-browser
```

2. Install dependencies:
```bash
npm install
```

3. Configure your R2 bucket:
   - Edit `wrangler.toml` and replace `your-bucket-name` with your actual R2 bucket name

### Development

1. Run the Vue development server:
```bash
npm run dev
```

2. In another terminal, run the Cloudflare Worker locally:
```bash
npm run dev:worker
```

3. Open http://localhost:3000 to view the app

### Deployment

1. Build the Vue app:
```bash
npm run build
```

2. Deploy to Cloudflare Workers:
```bash
wrangler deploy
```

Or use the combined command:
```bash
npm run deploy
```

## Configuration

### R2 Bucket Structure

The app expects images to be organized in folders within your R2 bucket:
```
bucket/
├── collection1/
│   ├── image1.png
│   ├── image2.jpg
│   └── icon.svg
├── collection2/
│   ├── logo.png
│   └── banner.jpg
└── misc/
    └── background.webp
```

### Supported Image Formats

- PNG
- JPG/JPEG
- GIF
- SVG
- WebP

## API Endpoints

The Worker provides these API endpoints:

- `GET /api/folders` - List all folders/collections
- `GET /api/images?folder=X` - List images in a specific folder
- `GET /images/*` - Serve image files

## Security

- The app provides read-only access to your R2 bucket
- CORS is configured to allow access from any origin (adjust as needed)
- Images are cached at the edge for 1 week

## License

MIT