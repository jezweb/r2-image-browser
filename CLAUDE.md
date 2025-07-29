# R2 Image Browser - Project Context

## Overview
R2 Image Browser is a Cloudflare Workers-based application for managing and browsing images stored in Cloudflare R2 buckets. The application features hierarchical folder support, authentication, and a modern Vue 3 + PrimeVue interface.

## Current Status (January 2025)
- **Production URL**: https://iconbrowser.jezweb.com
- **Deployment**: Cloudflare Workers with custom domain routing
- **Authentication**: Working with admin panel for folder management
- **Folder Support**: Full hierarchical folder structure implemented

## Recent Updates
1. **Authentication Fixes**: Resolved missing `.value` references on `authHeader` in FolderManager component
   - Fixed in `loadFolders` function (line 232)
   - Fixed in `saveRename` function (line 289)
   - Fixed API response parsing to use `foldersData.data.folders`

2. **Folder Upload Modal Styling**: Enhanced with PrimeVue components and custom CSS
   - Added professional header with icon
   - Improved drop zone styling with hover effects
   - Enhanced CSS specificity to ensure proper theme application

## Tech Stack
- **Frontend**: Vue 3 (Composition API) + PrimeVue + PrimeFlex
- **Backend**: Cloudflare Workers
- **Storage**: Cloudflare R2
- **Build**: Vite
- **Deployment**: Wrangler CLI

## Key Components
- `/src/components/FolderManager.vue` - Main folder management interface in admin panel
- `/src/components/FolderUploadModal.vue` - Modal for uploading folders with drag-and-drop
- `/src/views/AdminView.vue` - Admin panel container
- `/src/workers/api.js` - Cloudflare Workers API endpoints

## Known Issues
- PrimeVue theme styling may need stronger CSS specificity in some components
- Browser caching can delay visibility of style updates

## Deployment Commands
```bash
npm run deploy  # Builds and deploys to Cloudflare Workers
git push origin master  # Pushes to GitHub repository
```

## API Authentication
All admin API endpoints require Authorization header with the configured password.