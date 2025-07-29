# R2 Image Browser - Comprehensive Project Documentation

## Overview
R2 Image Browser is a full-featured Cloudflare Workers-based application for managing and browsing images stored in Cloudflare R2 buckets. It provides a modern, responsive interface with hierarchical folder support, authentication, and advanced file management capabilities.

## Current Status (January 2025)
- **Production URL**: https://iconbrowser.jezweb.com
- **Deployment**: Cloudflare Workers with custom domain routing
- **Architecture**: Vue 3 SPA + Cloudflare Workers API
- **Authentication**: Working with Basic Auth for admin features
- **Folder Support**: Full hierarchical folder structure with some pagination limitations

## Core Features

### 1. Browse Mode (Public/Authenticated)
- **Folder Navigation**: 
  - Hierarchical folder tree view with expand/collapse
  - Breadcrumb navigation
  - Back/Forward history navigation
  - Direct path input (advanced mode)
- **View Options**:
  - Grid view with thumbnail previews
  - List view with file details
  - Sort by name/date/size/type (asc/desc)
- **File Operations**:
  - Click to copy image URL
  - View image metadata (size, dimensions, upload date)
  - Folder statistics (file count, total size)

### 2. Admin Panel Features
- **Authentication Required**: Basic auth with username/password
- **Folder Management**:
  - Create new folders
  - Rename folders
  - Delete folders (with recursive deletion)
  - Move folders to different locations
  - View folder statistics
- **File Upload**:
  - Single file upload
  - Batch file upload
  - Drag-and-drop folder upload (preserves structure)
  - Progress tracking with visual feedback
  - Automatic folder creation for nested uploads
- **Admin Dashboard**:
  - Total storage usage
  - File count statistics
  - Folder listing with actions

### 3. Technical Features
- **API Endpoints**:
  - `GET /api/folders` - List folders with optional depth, pagination
  - `GET /api/images` - List images in a folder
  - `GET /api/admin/stats` - Get storage statistics
  - `POST /api/admin/upload` - Single file upload
  - `POST /api/admin/upload/batch` - Batch file upload
  - `POST /api/admin/folders` - Create folder
  - `POST /api/admin/folders/nested` - Create nested folder structure
  - `PUT /api/admin/folders/:name` - Rename folder
  - `PUT /api/admin/folders/move` - Move folder
  - `DELETE /api/admin/folders/:name` - Delete folder
  - `DELETE /api/admin/folders/recursive` - Recursive folder deletion

## Tech Stack
- **Frontend**: 
  - Vue 3 (Composition API)
  - PrimeVue UI Components
  - PrimeFlex CSS utilities
  - Vue Router for navigation
- **Backend**: 
  - Cloudflare Workers (Edge computing)
  - Cloudflare R2 for object storage
- **Build Tools**:
  - Vite for development and building
  - Wrangler for Cloudflare deployment
- **Testing**:
  - Vitest for unit tests
  - Component and integration tests

## Key Components

### Frontend Components
1. **FolderNavigator.vue** - Main navigation interface with tree view
2. **FolderManager.vue** - Admin panel for folder management
3. **FolderUploadModal.vue** - Drag-and-drop folder upload interface
4. **FolderTreeView.vue** - Recursive tree view component
5. **LoginForm.vue** - Authentication interface
6. **FileUpload.vue** - File upload component
7. **ThumbnailImage.vue** - Optimized image thumbnail display

### Views
1. **BrowserView.vue** - Main browsing interface
2. **AdminView.vue** - Admin control panel

### Worker Functions
1. **index.js** - Main Cloudflare Worker with all API endpoints
2. **worker-functions.js** - Extracted functions for testing

## Known Issues & Limitations

### ~~Critical Issue: Folder Tree Limited Display~~ (FIXED)
**Problem**: The folder tree was only showing limited folders (e.g., 18) despite setting a 1000 limit.

**Root Cause**: When `depth > 1`, the `handleListFolders` function didn't implement pagination for R2 list operations. It only processed the first batch of objects returned by R2 (up to 1000), which didn't include all folders when there were many files.

**Solution Implemented**: Added pagination loop to fetch all objects before building hierarchy:
```javascript
// Deep listing - need to fetch all objects with pagination
const allObjects = [];
let cursor = undefined;
let hasMore = true;

while (hasMore) {
  const deepListOptions = {
    prefix: sanitizedPath ? `${sanitizedPath}/` : '',
    limit: 1000,
    cursor: cursor
  };
  
  const deepListed = await env.IMAGE_BUCKET.list(deepListOptions);
  
  if (deepListed.objects && deepListed.objects.length > 0) {
    allObjects.push(...deepListed.objects);
  }
  
  hasMore = deepListed.truncated;
  cursor = deepListed.cursor;
  
  // Safety limit to prevent infinite loops
  if (allObjects.length > 50000) {
    console.warn('Reached safety limit of 50,000 objects');
    break;
  }
}
```

**Status**: Fixed and deployed on January 29, 2025

### Other Limitations
1. **Performance**:
   - No caching mechanism for folder structure
   - Preview images load synchronously
   - Large folders may be slow to load

2. **UI/UX**:
   - Tree view state not persisted between sessions
   - No search functionality
   - Long folder names may overflow
   - Upload modal styling issues on some browsers

3. **Security**:
   - Basic auth credentials stored in localStorage
   - No rate limiting on API endpoints
   - No file type validation beyond extensions

4. **Features Not Implemented**:
   - Bulk file operations (delete, move)
   - Image editing/cropping
   - Sharing links with expiration
   - Access control per folder
   - Audit logging

## Configuration

### Environment Variables (wrangler.toml)
- `IMAGE_BUCKET` - R2 bucket binding name
- `ADMIN_USERNAME` - Admin authentication username
- `ADMIN_PASSWORD` - Admin authentication password

### Build Configuration
- Node.js 18+ required
- Uses ES modules
- Cloudflare Pages compatible build output

## Deployment Commands
```bash
# Development
npm run dev         # Local development server

# Testing
npm test           # Run all tests
npm run test:unit  # Unit tests only

# Production
npm run build      # Build for production
npm run deploy     # Deploy to Cloudflare Workers

# Git workflow
git add -A
git commit -m "message"
git push origin master
```

## Recent Updates (January 2025)
1. Fixed authentication issues with missing `.value` on authHeader refs
2. Enhanced folder upload modal styling with PrimeVue components
3. Added limit parameter (1000) to folder API calls
4. Improved CSS specificity for theme application
5. Added comprehensive project documentation
6. **Fixed folder tree pagination issue** - Now properly fetches all folders (up to 50k objects) instead of just the first 1000

## Security Considerations
- All admin endpoints require authentication
- Path traversal protection in place
- File name sanitization implemented
- CORS headers configured for production domain

## Performance Optimizations
- Lazy loading for folder contents
- Thumbnail generation on-demand
- Pagination for large folder listings
- Efficient R2 API usage with prefixes and delimiters

## Future Improvements
1. Add Redis/KV caching for folder structure
2. Implement WebSocket for real-time updates
3. Add image optimization/resizing on upload
4. Create mobile app version
5. Add advanced search and filtering
6. Implement folder-level permissions
7. Add activity logging and analytics
8. Persist tree view expansion state
9. Add bulk file operations (multi-select)
10. Implement drag-and-drop file moving between folders

## API Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Pagination Format
```json
{
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true,
    "cursor": "next-page-cursor"
  }
}
```

## Testing Strategy
- Unit tests for utility functions
- Component tests for Vue components
- Integration tests for upload workflows
- API endpoint tests with mocked R2

## Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers supported

## Performance Metrics
- Initial load: <2s
- Folder navigation: <500ms
- Image preview load: <1s
- Upload speed: Limited by connection

## Monitoring
- Cloudflare Analytics for traffic
- Worker metrics for performance
- R2 storage metrics for usage

---
*Last updated: January 2025*