# Technical Specifications: Nested Folders & Drag-and-Drop

## Overview

This document outlines the technical implementation approach for adding hierarchical folder support and drag-and-drop folder upload capabilities to the R2 Image Browser.

---

## 1. System Architecture

### 1.1 Current Architecture Analysis

#### Existing Components
```
Frontend (Vue 3 SPA)
├── Components/
│   ├── FileUpload.vue (flat file upload)
│   ├── FolderManager.vue (flat folder operations)
│   └── LoginForm.vue (authentication)
├── Views/
│   ├── BrowserView.vue (image browsing)
│   └── AdminView.vue (administration)
└── Router (client-side routing)

Backend (Cloudflare Worker)
├── Authentication (HTTP Basic Auth)
├── API Endpoints
│   ├── /api/folders (flat folder listing)
│   ├── /api/images (image listing)
│   └── /api/admin/* (admin operations)
└── R2 Storage Integration
```

#### Current Limitations
- **Flat Structure**: `delimiter: '/'` only shows top-level folders
- **Single File Upload**: No batch or folder upload support
- **No Hierarchy**: Cannot create or navigate nested folders
- **Limited Operations**: Basic CRUD only for single-level folders

### 1.2 Target Architecture

#### Enhanced System Design
```
Frontend (Vue 3 SPA)
├── Components/
│   ├── FolderDropZone.vue (enhanced drag-and-drop)
│   ├── FolderTreeUpload.vue (folder structure preview)
│   ├── UploadProgressTree.vue (hierarchical progress)
│   ├── FolderNavigator.vue (breadcrumb + tree nav)
│   └── [existing components]
├── Services/
│   ├── folderService.js (hierarchical operations)
│   ├── uploadService.js (batch upload logic)
│   └── dragDropService.js (browser API integration)
└── Utils/
    ├── pathUtils.js (path manipulation)
    └── validationUtils.js (path/file validation)

Backend (Cloudflare Worker)
├── Enhanced API Endpoints
│   ├── /api/folders?path={parent}&depth={level}
│   ├── /api/admin/folders/nested
│   ├── /api/admin/upload/batch
│   └── /api/admin/folders/move
└── Enhanced R2 Integration
    ├── Hierarchical listing
    ├── Batch operations
    └── Recursive operations
```

---

## 2. R2 Storage Implementation

### 2.1 Object Key Strategy

#### Hierarchical Key Pattern
```
Current: "folder-name/image.jpg"
Target:  "category/subcategory/folder/image.jpg"
```

#### Key Constraints & Validation
- **Maximum Length**: 1024 characters (R2 limit)
- **Character Restrictions**: No control characters, UTF-8 encoded
- **Path Separators**: Forward slash (/) only
- **Reserved Patterns**: Avoid `.thumb/` and other system prefixes

#### Example Key Structures
```
icons/
├── categories/
│   ├── animals/
│   │   ├── mammals/cats/persian.jpg
│   │   └── birds/eagles/golden.jpg
│   └── vehicles/
│       └── cars/sedan/honda.jpg
└── ui-elements/
    ├── buttons/primary/submit.png
    └── icons/social/facebook.svg
```

### 2.2 R2 API Operations

#### Enhanced Listing Operations
```javascript
// Current: Flat folder listing
await env.IMAGE_BUCKET.list({
  delimiter: '/',
  limit: 1000
});

// Enhanced: Hierarchical listing with parent path
await env.IMAGE_BUCKET.list({
  prefix: 'categories/animals/',  // Parent path
  delimiter: '/',                 // Show immediate children only
  limit: 1000
});

// Deep listing: All files in hierarchy
await env.IMAGE_BUCKET.list({
  prefix: 'categories/animals/',  // Parent path
  // No delimiter = show all nested files
  limit: 1000
});
```

#### Batch Upload Strategy
```javascript
// Sequential upload with progress tracking
for (const file of folderFiles) {
  const key = `${parentPath}/${file.relativePath}`;
  await env.IMAGE_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });
  // Update progress after each file
}
```

#### Recursive Delete Implementation
```javascript
// List all objects with prefix
const objects = await env.IMAGE_BUCKET.list({
  prefix: `${folderPath}/`,
  limit: 1000
});

// Delete in batches to avoid timeouts
const batchSize = 100;
for (let i = 0; i < objects.objects.length; i += batchSize) {
  const batch = objects.objects.slice(i, i + batchSize);
  await Promise.all(
    batch.map(obj => env.IMAGE_BUCKET.delete(obj.key))
  );
}
```

---

## 3. Browser API Integration

### 3.1 Drag-and-Drop Implementation

#### Core Browser APIs
```javascript
// DataTransfer API for drag-and-drop detection
const handleDrop = (event) => {
  event.preventDefault();
  const items = event.dataTransfer.items;
  
  for (let item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      if (entry.isDirectory) {
        processDirectoryEntry(entry, '');
      } else {
        processFileEntry(entry);
      }
    }
  }
};

// Recursive directory processing
const processDirectoryEntry = (dirEntry, parentPath) => {
  const reader = dirEntry.createReader();
  const fullPath = parentPath + dirEntry.name;
  
  reader.readEntries((entries) => {
    entries.forEach(entry => {
      if (entry.isDirectory) {
        processDirectoryEntry(entry, fullPath + '/');
      } else {
        entry.file(file => {
          file.relativePath = fullPath + '/' + file.name;
          addToUploadQueue(file);
        });
      }
    });
  });
};
```

#### Browser Compatibility Strategy
```javascript
// Progressive enhancement approach
const supportsDirectoryDrop = 'webkitGetAsEntry' in DataTransferItem.prototype;

if (supportsDirectoryDrop) {
  // Use advanced drag-and-drop API
  enableAdvancedDropZone();
} else {
  // Fallback to input[webkitdirectory]
  enableFallbackUpload();
}

// Fallback implementation
const enableFallbackUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.multiple = true;
  
  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    processFileList(files);
  });
};
```

### 3.2 Upload Progress Implementation

#### Progress Tracking Architecture
```javascript
// Upload progress manager
class UploadProgressManager {
  constructor() {
    this.folderProgress = new Map();
    this.fileProgress = new Map();
    this.totalFiles = 0;
    this.completedFiles = 0;
  }
  
  initializeFolder(folderPath, fileCount) {
    this.folderProgress.set(folderPath, {
      total: fileCount,
      completed: 0,
      percentage: 0
    });
  }
  
  updateFileProgress(filePath, percentage) {
    this.fileProgress.set(filePath, percentage);
    
    // Update folder progress
    const folderPath = this.getFolderPath(filePath);
    const folder = this.folderProgress.get(folderPath);
    if (folder) {
      folder.completed = this.getCompletedFilesInFolder(folderPath);
      folder.percentage = (folder.completed / folder.total) * 100;
    }
    
    // Emit progress event
    this.emitProgress();
  }
}
```

---

## 4. Performance Optimization

### 4.1 Frontend Performance

#### Virtual Scrolling for Large Lists
```javascript
// Implementation for large folder contents
import { RecycleScroller } from 'vue-virtual-scroller';

// Component template
<RecycleScroller
  class="folder-list"
  :items="folderContents"
  :item-size="60"
  key-field="id"
  v-slot="{ item }"
>
  <FolderItem :item="item" />
</RecycleScroller>
```

#### Lazy Loading Strategy
```javascript
// Load folder contents on demand
const loadFolderContents = async (folderPath, offset = 0, limit = 100) => {
  const response = await fetch(`/api/folders?path=${folderPath}&offset=${offset}&limit=${limit}`);
  return response.json();
};

// Infinite scrolling implementation
const useInfiniteScroll = (folderPath) => {
  const items = ref([]);
  const loading = ref(false);
  const hasMore = ref(true);
  
  const loadMore = async () => {
    if (loading.value || !hasMore.value) return;
    
    loading.value = true;
    const newItems = await loadFolderContents(folderPath, items.value.length);
    
    items.value.push(...newItems.items);
    hasMore.value = newItems.hasMore;
    loading.value = false;
  };
  
  return { items, loading, hasMore, loadMore };
};
```

### 4.2 Backend Performance

#### Chunked Upload Processing
```javascript
// Process uploads in chunks to avoid Worker timeout
const CHUNK_SIZE = 50; // Files per chunk
const CHUNK_TIMEOUT = 30000; // 30 seconds per chunk

const handleBatchUpload = async (request, env, corsHeaders) => {
  const formData = await request.formData();
  const files = formData.getAll('files');
  const folderStructure = JSON.parse(formData.get('folderStructure'));
  
  // Process in chunks
  const chunks = chunkArray(files, CHUNK_SIZE);
  const results = [];
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(file => uploadSingleFile(file, env))
    );
    results.push(...chunkResults);
    
    // Send progress update
    await sendProgressUpdate(results.length, files.length);
  }
  
  return new Response(JSON.stringify({
    success: true,
    results
  }), { headers: corsHeaders });
};
```

#### Optimized R2 Listing
```javascript
// Efficient folder listing with caching
const getFolderContents = async (env, folderPath, depth = 1) => {
  const cacheKey = `folder:${folderPath}:${depth}`;
  
  // Check cache first (if implemented)
  // const cached = await getFromCache(cacheKey);
  // if (cached) return cached;
  
  const options = {
    prefix: folderPath ? `${folderPath}/` : '',
    delimiter: depth === 1 ? '/' : undefined,
    limit: 1000
  };
  
  const result = await env.IMAGE_BUCKET.list(options);
  
  // Process and structure the response
  const processed = {
    folders: result.delimitedPrefixes?.map(prefix => ({
      name: prefix.replace(/\/$/, '').split('/').pop(),
      path: prefix.replace(/\/$/, ''),
      isFolder: true
    })) || [],
    files: result.objects?.map(obj => ({
      name: obj.key.split('/').pop(),
      path: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      isFile: true
    })) || []
  };
  
  // Cache the result (if implemented)
  // await setCache(cacheKey, processed, 300); // 5 minute cache
  
  return processed;
};
```

---

## 5. Security Implementation

### 5.1 Path Validation

#### Comprehensive Path Sanitization
```javascript
// Path validation utility
const validateAndSanitizePath = (path) => {
  // Remove leading/trailing slashes and whitespace
  path = path.trim().replace(/^\/+|\/+$/g, '');
  
  // Security checks
  if (path.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  if (path.includes('//')) {
    throw new Error('Double slashes not allowed');
  }
  
  // Character validation
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(path)) {
    throw new Error('Invalid characters in path');
  }
  
  // Length validation
  if (path.length > 900) { // Leave buffer for filename
    throw new Error('Path too long');
  }
  
  // Sanitize path segments
  const segments = path.split('/').map(segment => {
    // Remove control characters and normalize
    return segment.replace(/[\x00-\x1f]/g, '').trim();
  }).filter(segment => segment.length > 0);
  
  return segments.join('/');
};

// File name validation
const validateFileName = (filename) => {
  const invalidChars = /[<>:"|?*\x00-\x1f\/\\]/;
  if (invalidChars.test(filename)) {
    throw new Error('Invalid characters in filename');
  }
  
  if (filename.length > 255) {
    throw new Error('Filename too long');
  }
  
  return filename.trim();
};
```

### 5.2 Upload Security

#### File Type and Size Validation
```javascript
// Enhanced file validation for nested uploads
const validateUploadFile = (file, relativePath) => {
  // Existing image type validation
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}`);
  }
  
  // Size validation
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`File too large: ${file.size} bytes`);
  }
  
  // Path validation
  const sanitizedPath = validateAndSanitizePath(relativePath);
  const sanitizedFilename = validateFileName(file.name);
  
  return {
    isValid: true,
    sanitizedPath,
    sanitizedFilename,
    finalKey: sanitizedPath ? `${sanitizedPath}/${sanitizedFilename}` : sanitizedFilename
  };
};
```

---

## 6. Error Handling Strategy

### 6.1 Upload Error Recovery

#### Resilient Upload Implementation
```javascript
// Upload with retry logic
const uploadFileWithRetry = async (file, key, env, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await env.IMAGE_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });
      
      return { success: true, key };
    } catch (error) {
      if (attempt === maxRetries) {
        return { 
          success: false, 
          key, 
          error: error.message,
          attempts: attempt
        };
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};

// Batch upload with partial failure handling
const handleBatchUploadWithErrorRecovery = async (files, env) => {
  const results = [];
  const failed = [];
  
  for (const file of files) {
    const result = await uploadFileWithRetry(file.file, file.key, env);
    results.push(result);
    
    if (!result.success) {
      failed.push(result);
    }
  }
  
  return {
    total: files.length,
    successful: results.filter(r => r.success).length,
    failed: failed.length,
    results,
    failedUploads: failed
  };
};
```

### 6.2 User Feedback System

#### Comprehensive Error Reporting
```javascript
// Error classification and user messaging
const classifyError = (error) => {
  if (error.message.includes('too large')) {
    return {
      type: 'file_size',
      userMessage: 'File is too large. Maximum size is 10MB.',
      action: 'reduce_size'
    };
  }
  
  if (error.message.includes('Invalid file type')) {
    return {
      type: 'file_type',
      userMessage: 'Only image files are allowed (PNG, JPG, GIF, SVG, WebP).',
      action: 'convert_file'
    };
  }
  
  if (error.message.includes('network')) {
    return {
      type: 'network',
      userMessage: 'Network error occurred. Please check your connection and try again.',
      action: 'retry'
    };
  }
  
  return {
    type: 'unknown',
    userMessage: 'An unexpected error occurred. Please try again.',
    action: 'contact_support'
  };
};
```

---

## 7. Testing Strategy

### 7.1 Unit Testing

#### Component Testing Approach
```javascript
// Example test for FolderDropZone component
import { mount } from '@vue/test-utils';
import FolderDropZone from '@/components/FolderDropZone.vue';

describe('FolderDropZone', () => {
  test('detects folder drop correctly', async () => {
    const wrapper = mount(FolderDropZone);
    
    // Mock DataTransfer with folder entry
    const mockEntry = {
      isDirectory: true,
      name: 'test-folder',
      createReader: () => ({
        readEntries: (callback) => callback([])
      })
    };
    
    const dropEvent = new Event('drop');
    dropEvent.dataTransfer = {
      items: [{
        webkitGetAsEntry: () => mockEntry
      }]
    };
    
    await wrapper.vm.handleDrop(dropEvent);
    
    expect(wrapper.emitted('folder-detected')).toBeTruthy();
  });
});
```

### 7.2 Integration Testing

#### API Endpoint Testing
```javascript
// Test for nested folder operations
describe('Nested Folder API', () => {
  test('creates nested folder structure', async () => {
    const response = await fetch('/api/admin/folders/nested', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'categories/animals/mammals'
      })
    });
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.path).toBe('categories/animals/mammals');
  });
});
```

### 7.3 Performance Testing

#### Load Testing Strategy
```javascript
// Performance test for large folder uploads
describe('Upload Performance', () => {
  test('handles 1000 file upload within time limit', async () => {
    const startTime = Date.now();
    
    // Generate mock file list
    const files = generateMockFiles(1000);
    
    const result = await uploadBatch(files);
    
    const duration = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(600000); // 10 minutes
    expect(result.successful).toBe(1000);
  });
});
```

---

## 8. Deployment Considerations

### 8.1 Migration Strategy

#### Zero-Downtime Deployment
- **Feature Flags**: Enable nested folder features progressively
- **Backward Compatibility**: Maintain existing API endpoints
- **Data Migration**: No migration needed - existing structure remains valid

### 8.2 Monitoring and Logging

#### Performance Monitoring
```javascript
// Performance tracking for upload operations
const trackUploadPerformance = (operation, duration, fileCount, totalSize) => {
  // Send metrics to monitoring system
  console.log({
    operation,
    duration,
    fileCount,
    totalSize,
    averageFileSize: totalSize / fileCount,
    throughput: fileCount / (duration / 1000) // files per second
  });
};
```

---

*Document Version*: 1.0  
*Created*: Phase 1 - Technical Analysis  
*Last Updated*: Initial creation