# System Architecture: Nested Folders & Drag-and-Drop

## Overview

This document provides a comprehensive overview of the system architecture for the enhanced R2 Image Browser with hierarchical folder support and drag-and-drop folder upload capabilities.

---

## 1. High-Level Architecture

### **System Diagram**
```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
├─────────────────────────────────────────────────────────────────┤
│  Vue 3 SPA Application                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Components    │  │     Services    │  │      Utils      │ │
│  │                 │  │                 │  │                 │ │
│  │ FolderDropZone  │  │ folderService   │  │ pathUtils       │ │
│  │ FolderNavigator │  │ uploadService   │  │ validationUtils │ │
│  │ ProgressTree    │  │ dragDropService │  │ fileUtils       │ │
│  │ FolderManager   │  │ apiService      │  │ formatUtils     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  Vue Router + State Management (Pinia/Composition API)         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/REST API
                                    │ WebSocket (Future)
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Worker                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Auth Layer     │  │   API Routes    │  │   Utilities     │ │
│  │                 │  │                 │  │                 │ │
│  │ Basic Auth      │  │ /api/folders    │  │ pathValidation  │ │
│  │ Session Mgmt    │  │ /api/upload     │  │ errorHandling   │ │
│  │ Rate Limiting   │  │ /api/search     │  │ responseFormat  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  Business Logic Layer                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Folder Handler  │  │ Upload Handler  │  │ Search Handler  │ │
│  │                 │  │                 │  │                 │ │
│  │ listFolders()   │  │ batchUpload()   │  │ searchFiles()   │ │
│  │ createFolder()  │  │ chunkUpload()   │  │ indexContent()  │ │
│  │ moveFolder()    │  │ progressTrack() │  │ filterResults() │ │
│  │ deleteFolder()  │  │ conflictResolv()│  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ R2 API Calls
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare R2 Storage                        │
├─────────────────────────────────────────────────────────────────┤
│  Object Storage with Hierarchical Key Structure                │
│                                                                 │
│  Key Pattern: "folder1/subfolder/filename.ext"                 │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Categories    │  │   UI Elements   │  │    Projects     │ │
│  │                 │  │                 │  │                 │ │
│  │ animals/        │  │ icons/          │  │ 2024/           │ │
│  │   mammals/      │  │   social/       │  │   campaign-a/   │ │
│  │     cats/       │  │     facebook/   │  │     assets/     │ │
│  │   birds/        │  │   navigation/   │  │   campaign-b/   │ │
│  │ vehicles/       │  │ buttons/        │  │     logos/      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### **2.1 Frontend Architecture (Vue 3)**

#### **Component Hierarchy**
```
App.vue
├── LoginForm.vue (existing)
├── router-view
    ├── BrowserView.vue
    │   ├── FolderNavigator.vue (new)
    │   │   ├── BreadcrumbNav.vue
    │   │   └── TreeView.vue
    │   ├── ImageGrid.vue (existing, enhanced)
    │   └── SearchBar.vue (new)
    └── AdminView.vue
        ├── FileUpload.vue (existing)
        ├── FolderDropZone.vue (new)
        ├── FolderTreeUpload.vue (new)
        ├── UploadProgressTree.vue (new)
        ├── FolderManager.vue (existing, enhanced)
        └── CreateFolderModal.vue (existing)
```

#### **State Management Strategy**
```javascript
// Using Vue 3 Composition API + Pinia
import { defineStore } from 'pinia'

export const useFolderStore = defineStore('folders', () => {
  // State
  const currentPath = ref('')
  const folderTree = ref({})
  const selectedItems = ref([])
  const uploadProgress = ref(new Map())
  
  // Getters
  const currentFolderContents = computed(() => 
    getFolderContents(folderTree.value, currentPath.value)
  )
  
  const breadcrumbPath = computed(() => 
    currentPath.value.split('/').filter(Boolean)
  )
  
  // Actions
  const navigateToFolder = (path) => {
    currentPath.value = path
    loadFolderContents(path)
  }
  
  const createFolder = async (parentPath, name) => {
    const fullPath = `${parentPath}/${name}`.replace(/^\//, '')
    await api.createFolder(fullPath)
    await loadFolderContents(parentPath)
  }
  
  return {
    currentPath,
    folderTree,
    selectedItems,
    uploadProgress,
    currentFolderContents,
    breadcrumbPath,
    navigateToFolder,
    createFolder
  }
})
```

### **2.2 Service Layer Architecture**

#### **API Service (apiService.js)**
```javascript
class ApiService {
  constructor(baseURL, authHeader) {
    this.baseURL = baseURL
    this.authHeader = authHeader
  }
  
  // Folder operations
  async getFolders(path = '', options = {}) {
    const params = new URLSearchParams({
      path,
      depth: options.depth || 1,
      include_files: options.includeFiles || false,
      limit: options.limit || 1000,
      offset: options.offset || 0
    })
    
    return this.request(`/api/folders?${params}`)
  }
  
  async createNestedFolder(path, createParents = true) {
    return this.request('/api/admin/folders/nested', {
      method: 'POST',
      body: JSON.stringify({ path, createParents })
    })
  }
  
  async batchUpload(files, folderStructure, options = {}) {
    const formData = new FormData()
    
    files.forEach(file => formData.append('files', file))
    formData.append('folderStructure', JSON.stringify(folderStructure))
    formData.append('conflictResolution', options.conflictResolution || 'rename')
    
    return this.request('/api/admin/upload/batch', {
      method: 'POST',
      body: formData
    })
  }
}
```

#### **Drag-and-Drop Service (dragDropService.js)**
```javascript
class DragDropService {
  constructor() {
    this.supportsFolderUpload = 'webkitGetAsEntry' in DataTransferItem.prototype
  }
  
  async processDroppedItems(dataTransferItems) {
    const fileStructure = new Map()
    
    for (const item of dataTransferItems) {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        if (entry.isDirectory) {
          await this.processDirectoryEntry(entry, '', fileStructure)
        } else {
          const file = await this.getFileFromEntry(entry)
          fileStructure.set(entry.name, { file, path: entry.name })
        }
      }
    }
    
    return fileStructure
  }
  
  async processDirectoryEntry(dirEntry, parentPath, fileStructure) {
    const reader = dirEntry.createReader()
    const currentPath = parentPath + dirEntry.name
    
    const entries = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        await this.processDirectoryEntry(entry, currentPath + '/', fileStructure)
      } else {
        const file = await this.getFileFromEntry(entry)
        const fullPath = currentPath + '/' + entry.name
        fileStructure.set(entry.name, { file, path: fullPath })
      }
    }
  }
}
```

---

## 3. Backend Architecture (Cloudflare Worker)

### **3.1 Request Flow Architecture**

```
Incoming Request
       │
       ▼
┌─────────────────┐
│  CORS Handler   │ ── OPTIONS requests
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Auth Middleware │ ── API routes only
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ Route Resolver  │ ── Path matching
└─────────────────┘
       │
       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Folder Handler  │    │ Upload Handler  │    │ Static Assets   │
│                 │    │                 │    │                 │
│ • List folders  │    │ • Batch upload  │    │ • Vue SPA       │
│ • Create folder │    │ • Chunk upload  │    │ • Static files  │
│ • Move folder   │    │ • Progress      │    │ • Client routes │
│ • Delete folder │    │ • Conflicts     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Formatter                           │
│                                                                 │
│ • Consistent JSON structure                                     │
│ • Error handling and mapping                                    │
│ • CORS headers application                                      │
│ • Performance logging                                           │
└─────────────────────────────────────────────────────────────────┘
```

### **3.2 Handler Architecture**

#### **Base Handler Pattern**
```javascript
class BaseHandler {
  constructor(env, corsHeaders) {
    this.env = env
    this.corsHeaders = corsHeaders
  }
  
  async execute(request) {
    try {
      const result = await this.handle(request)
      return this.success(result)
    } catch (error) {
      return this.error(error)
    }
  }
  
  success(data, message) {
    return new Response(JSON.stringify({
      success: true,
      message,
      data
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...this.corsHeaders
      }
    })
  }
  
  error(error, status = 500) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...this.corsHeaders
      }
    })
  }
}
```

#### **Folder Handler Implementation**
```javascript
class FolderHandler extends BaseHandler {
  async handleList(path, options) {
    const r2Options = {
      prefix: path ? `${path}/` : '',
      delimiter: options.depth === 1 ? '/' : undefined,
      limit: options.limit || 1000
    }
    
    const result = await this.env.IMAGE_BUCKET.list(r2Options)
    
    return {
      folders: this.extractFolders(result.delimitedPrefixes),
      files: options.includeFiles ? this.extractFiles(result.objects) : [],
      pagination: this.buildPagination(result, options)
    }
  }
  
  async handleCreate(path, createParents) {
    const segments = path.split('/').filter(Boolean)
    const createdPaths = []
    
    if (createParents) {
      for (let i = 0; i < segments.length; i++) {
        const currentPath = segments.slice(0, i + 1).join('/')
        const exists = await this.folderExists(currentPath)
        
        if (!exists) {
          await this.createFolderPlaceholder(currentPath)
          createdPaths.push(currentPath)
        }
      }
    } else {
      await this.createFolderPlaceholder(path)
      createdPaths.push(path)
    }
    
    return { path, createdPaths }
  }
}
```

---

## 4. Data Flow Architecture

### **4.1 Folder Upload Flow**

```
User Action: Drag folder to browser
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Browser Drag-and-Drop Detection                             │
├─────────────────────────────────────────────────────────────────┤
│ • DataTransfer API captures drop event                         │
│ • webkitGetAsEntry() identifies folders vs files               │
│ • Recursive traversal builds file structure map                │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Frontend Processing                                          │
├─────────────────────────────────────────────────────────────────┤
│ • File validation (type, size, path)                           │
│ • Folder structure preview generation                          │
│ • User confirmation and conflict resolution                    │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Upload Strategy Selection                                    │
├─────────────────────────────────────────────────────────────────┤
│ Small batch (< 50 files)  │  Large batch (> 50 files)         │
│ • Direct batch upload     │  • Chunked upload strategy        │
│ • Single API call         │  • Progress streaming             │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Worker Processing                                            │
├─────────────────────────────────────────────────────────────────┤
│ • Authentication and validation                                 │
│ • Folder structure creation in R2                              │
│ • File upload with progress tracking                           │
│ • Error handling and retry logic                               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. R2 Storage Operations                                        │
├─────────────────────────────────────────────────────────────────┤
│ • Object creation with hierarchical keys                       │
│ • Metadata storage (content-type, size, etc.)                  │
│ • Atomic operations for consistency                             │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Response and UI Update                                       │
├─────────────────────────────────────────────────────────────────┤
│ • Upload results returned to frontend                          │
│ • Folder tree state updated                                    │
│ • Navigation and URL state synchronized                        │
│ • Success/error notifications displayed                        │
└─────────────────────────────────────────────────────────────────┘
```

### **4.2 Navigation Flow**

```
User Navigation Action
        │
        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Breadcrumb      │    │ Tree View       │    │ Direct URL      │
│ Click           │    │ Click           │    │ Access          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Route Handler (Vue Router)                                      │
├─────────────────────────────────────────────────────────────────┤
│ • Parse path parameters                                         │
│ • Validate folder path                                          │
│ • Update browser history                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ State Management (Pinia Store)                                 │
├─────────────────────────────────────────────────────────────────┤
│ • Update currentPath                                            │
│ • Trigger folder content loading                               │
│ • Update breadcrumb and tree view                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Call to Worker                                              │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/folders?path={folder}&include_files=true               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Worker R2 Operations                                            │
├─────────────────────────────────────────────────────────────────┤
│ • LIST operation with prefix and delimiter                     │
│ • Process results (folders vs files)                           │
│ • Format response with metadata                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI Component Updates                                            │
├─────────────────────────────────────────────────────────────────┤
│ • ImageGrid displays new content                               │
│ • FolderNavigator updates breadcrumb                           │
│ • TreeView highlights current folder                           │
│ • URL reflects current location                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Performance Architecture

### **5.1 Frontend Performance Strategy**

#### **Virtual Scrolling for Large Lists**
```javascript
// Using vue-virtual-scroller for 1000+ items
import { RecycleScroller } from 'vue-virtual-scroller'

const FolderContents = {
  components: { RecycleScroller },
  template: `
    <RecycleScroller
      class="folder-list"
      :items="folderContents"
      :item-size="estimatedItemSize"
      key-field="id"
      v-slot="{ item }"
    >
      <FolderItem :item="item" />
    </RecycleScroller>
  `
}
```

#### **Lazy Loading Strategy**
```javascript
// Intersection Observer for lazy loading
const useLazyLoading = (folderPath) => {
  const items = ref([])
  const loading = ref(false)
  const observer = ref(null)
  
  const loadMoreItems = async () => {
    if (loading.value) return
    loading.value = true
    
    const newItems = await api.getFolders(folderPath, {
      offset: items.value.length,
      limit: 100
    })
    
    items.value.push(...newItems.data.items)
    loading.value = false
  }
  
  onMounted(() => {
    observer.value = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMoreItems()
      }
    })
  })
  
  return { items, loading, observer }
}
```

### **5.2 Backend Performance Strategy**

#### **R2 Operation Optimization**
```javascript
// Efficient folder listing with caching
class OptimizedFolderHandler {
  async listFolders(path, options) {
    // Check cache first
    const cacheKey = `folders:${path}:${JSON.stringify(options)}`
    const cached = await this.getFromCache(cacheKey)
    if (cached && !options.bypassCache) {
      return cached
    }
    
    // Optimize R2 LIST operation
    const r2Options = {
      prefix: path ? `${path}/` : '',
      delimiter: options.depth === 1 ? '/' : undefined,
      limit: Math.min(options.limit || 1000, 1000) // R2 max
    }
    
    const result = await this.env.IMAGE_BUCKET.list(r2Options)
    const processed = this.processListResult(result, options)
    
    // Cache result for 5 minutes
    await this.setCache(cacheKey, processed, 300)
    
    return processed
  }
}
```

#### **Chunked Upload Processing**
```javascript
// Process large uploads in chunks to avoid timeouts
class ChunkedUploadHandler {
  async processBatchUpload(files, options) {
    const CHUNK_SIZE = 25 // Files per chunk
    const chunks = this.chunkArray(files, CHUNK_SIZE)
    const results = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkResults = await this.processChunk(chunk, i + 1, chunks.length)
      results.push(...chunkResults)
      
      // Send progress update (if WebSocket available)
      await this.sendProgressUpdate({
        completed: results.length,
        total: files.length,
        chunkNumber: i + 1,
        totalChunks: chunks.length
      })
    }
    
    return results
  }
}
```

---

## 6. Security Architecture

### **6.1 Input Validation Pipeline**

```
User Input
    │
    ▼
┌─────────────────┐
│ Client-side     │ ── Basic validation, user feedback
│ Validation      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Worker          │ ── Comprehensive security validation
│ Validation      │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ R2 Storage      │ ── Final safety checks
│ Operations      │
└─────────────────┘
```

#### **Validation Implementation**
```javascript
// Multi-layer validation approach
class SecurityValidator {
  validatePath(path) {
    // 1. Basic format validation
    if (typeof path !== 'string') {
      throw new Error('Path must be a string')
    }
    
    // 2. Security checks
    if (path.includes('..')) {
      throw new Error('Path traversal not allowed')
    }
    
    if (path.includes('//')) {
      throw new Error('Double slashes not allowed')
    }
    
    // 3. Character validation
    const invalidChars = /[<>:"|?*\x00-\x1f]/
    if (invalidChars.test(path)) {
      throw new Error('Invalid characters in path')
    }
    
    // 4. Length validation
    if (path.length > 900) {
      throw new Error('Path too long')
    }
    
    return this.sanitizePath(path)
  }
  
  sanitizePath(path) {
    return path
      .trim()
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .split('/')
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0)
      .join('/')
  }
}
```

### **6.2 Authentication & Authorization**

```javascript
// Layered security approach
class SecurityLayer {
  async authenticate(request) {
    // Extract and validate auth header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Basic ')) {
      throw new Error('Invalid authentication')
    }
    
    // Decode and verify credentials
    const credentials = this.decodeBasicAuth(authHeader)
    const isValid = await this.verifyCredentials(credentials)
    
    if (!isValid) {
      throw new Error('Authentication failed')
    }
    
    return credentials
  }
  
  authorize(credentials, operation, resource) {
    // Role-based access control (future enhancement)
    const permissions = this.getUserPermissions(credentials.username)
    const required = this.getRequiredPermissions(operation, resource)
    
    return this.hasPermissions(permissions, required)
  }
}
```

---

## 7. Monitoring & Observability

### **7.1 Performance Monitoring**

```javascript
// Performance tracking throughout the system
class PerformanceMonitor {
  trackUploadPerformance(operation, metrics) {
    const data = {
      timestamp: new Date().toISOString(),
      operation,
      duration: metrics.duration,
      fileCount: metrics.fileCount,
      totalSize: metrics.totalSize,
      throughput: metrics.fileCount / (metrics.duration / 1000),
      errors: metrics.errors || 0
    }
    
    // Send to monitoring system
    this.sendMetrics(data)
  }
  
  trackApiPerformance(endpoint, duration, status) {
    console.log({
      type: 'api_performance',
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString()
    })
  }
}
```

### **7.2 Error Tracking**

```javascript
// Comprehensive error tracking
class ErrorTracker {
  trackError(error, context) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: context.request?.headers.get('User-Agent'),
      url: context.request?.url
    }
    
    // Log to console (Cloudflare captures these)
    console.error('Application Error:', errorData)
    
    // Send to external monitoring service (future)
    // this.sendToErrorTracking(errorData)
  }
}
```

---

## 8. Deployment Architecture

### **8.1 Deployment Pipeline**

```
Code Changes
     │
     ▼
┌─────────────────┐
│ Development     │ ── Local testing with wrangler dev
│ Environment     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Build Process   │ ── npm run build + asset compilation
│                 │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Testing Suite   │ ── Unit, integration, e2e tests
│                 │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Worker Deploy   │ ── wrangler deploy to Cloudflare
│                 │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Production      │ ── Live environment with monitoring
│ Environment     │
└─────────────────┘
```

### **8.2 Feature Flag Strategy**

```javascript
// Progressive feature rollout
class FeatureFlags {
  constructor(env) {
    this.flags = {
      nested_folders: env.FEATURE_NESTED_FOLDERS === 'true',
      folder_upload: env.FEATURE_FOLDER_UPLOAD === 'true',
      chunked_upload: env.FEATURE_CHUNKED_UPLOAD === 'true',
      search_api: env.FEATURE_SEARCH_API === 'true'
    }
  }
  
  isEnabled(feature) {
    return this.flags[feature] || false
  }
}

// Usage in handlers
if (featureFlags.isEnabled('nested_folders')) {
  return await this.handleNestedFolders(request)
} else {
  return await this.handleFlatFolders(request)
}
```

---

## 9. Scalability Considerations

### **9.1 Horizontal Scaling**

- **Cloudflare Workers**: Auto-scale globally based on demand
- **R2 Storage**: Unlimited scalability with consistent performance
- **CDN Integration**: Global edge caching for static assets

### **9.2 Performance Bottlenecks & Solutions**

| Bottleneck | Solution | Implementation |
|------------|----------|----------------|
| Large folder listings | Pagination + Virtual scrolling | API pagination, Vue virtual scroller |
| Bulk uploads | Chunked processing | Worker timeout management |
| Deep folder traversal | Lazy loading | On-demand folder expansion |
| Search performance | Indexing strategy | Future: Search index service |

---

*Document Version*: 1.0  
*Created*: Phase 1 - Architecture Design  
*Last Updated*: Initial creation