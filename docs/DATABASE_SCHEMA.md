# Database Schema: R2 Object Key Patterns

## Overview

Since R2 is an object storage system (not a traditional database), this document defines the object key naming conventions, folder structure patterns, and metadata strategies used to implement hierarchical folder organization.

---

## 1. R2 Object Key Conventions

### **1.1 Hierarchical Key Structure**

R2 uses object keys to simulate folder hierarchies. Our key naming convention follows this pattern:

```
{folder_path}/{filename}

Examples:
- categories/animals/mammals/cats/persian.jpg
- ui-icons/navigation/arrows/left.svg
- projects/2024/campaign-a/logos/brand-primary.png
```

### **1.2 Key Components**

| Component | Description | Rules | Examples |
|-----------|-------------|-------|----------|
| **folder_path** | Hierarchical folder structure | Forward slash separated, no leading/trailing slashes | `categories/animals/mammals` |
| **filename** | Original file name | UTF-8 encoded, validated characters | `persian-cat.jpg` |
| **full_key** | Complete object identifier | `{folder_path}/{filename}` | `categories/animals/mammals/persian-cat.jpg` |

### **1.3 Key Validation Rules**

#### **Path Segment Rules**
- **Characters**: `a-z`, `A-Z`, `0-9`, `-`, `_`
- **No spaces**: Use hyphens or underscores instead
- **No special chars**: Avoid `<>:"|?*` and control characters
- **Case sensitive**: `Categories` ≠ `categories`
- **Length limit**: Maximum 900 characters for path, 255 for filename

#### **Reserved Patterns**
```
.thumb/          # Thumbnail directories (ignored)
.system/         # System files (reserved)
.temp/           # Temporary uploads (reserved)
```

---

## 2. Folder Structure Patterns

### **2.1 Logical Organization Patterns**

#### **Category-Based Structure**
```
categories/
├── animals/
│   ├── mammals/
│   │   ├── cats/
│   │   │   ├── persian.jpg
│   │   │   └── siamese.jpg
│   │   └── dogs/
│   │       ├── golden-retriever.jpg
│   │       └── labrador.jpg
│   └── birds/
│       ├── eagles/
│       └── sparrows/
└── vehicles/
    ├── cars/
    └── motorcycles/
```

#### **Project-Based Structure**
```
projects/
├── 2024/
│   ├── campaign-a/
│   │   ├── social-media/
│   │   │   ├── facebook/
│   │   │   └── instagram/
│   │   └── print/
│   │       ├── brochures/
│   │       └── posters/
│   └── campaign-b/
└── 2023/
    └── archived-campaigns/
```

#### **Asset Type Structure**
```
ui-elements/
├── icons/
│   ├── social/
│   │   ├── facebook.svg
│   │   └── twitter.svg
│   └── navigation/
│       ├── arrows/
│       └── buttons/
├── buttons/
│   ├── primary/
│   └── secondary/
└── backgrounds/
    ├── patterns/
    └── textures/
```

### **2.2 Mixed Hierarchy Example**

Real-world folder structure combining multiple organization patterns:

```
root/
├── brand-assets/
│   ├── logos/
│   │   ├── primary/
│   │   │   ├── logo-dark.svg
│   │   │   └── logo-light.svg
│   │   └── variations/
│   │       ├── icon-only.svg
│   │       └── text-only.svg
│   └── colors/
│       ├── primary-palette.png
│       └── secondary-palette.png
├── campaigns/
│   ├── 2024/
│   │   ├── spring-collection/
│   │   │   ├── hero-images/
│   │   │   ├── product-shots/
│   │   │   └── social-content/
│   │   └── summer-sale/
│   └── 2023/
├── product-images/
│   ├── category-a/
│   │   ├── subcategory-1/
│   │   └── subcategory-2/
│   └── category-b/
└── ui-components/
    ├── icons/
    │   ├── 16px/
    │   ├── 24px/
    │   └── 32px/
    └── illustrations/
        ├── onboarding/
        └── error-states/
```

---

## 3. Object Metadata Schema

### **3.1 R2 Native Metadata**

R2 automatically stores these metadata fields:

```javascript
{
  "key": "categories/animals/cats/persian.jpg",
  "size": 245760,
  "etag": "d41d8cd98f00b204e9800998ecf8427e",
  "lastModified": "2024-01-15T10:30:00.000Z",
  "storageClass": "STANDARD"
}
```

### **3.2 Custom HTTP Metadata**

We enhance objects with custom metadata during upload:

```javascript
{
  "contentType": "image/jpeg",
  "contentLength": "245760",
  "contentEncoding": "identity",
  "cacheControl": "public, max-age=31536000",
  "contentDisposition": "inline; filename=\"persian.jpg\""
}
```

### **3.3 Custom Metadata Schema**

Additional metadata stored as HTTP headers:

| Header | Description | Example |
|--------|-------------|---------|
| `x-folder-depth` | Nesting level | `3` |
| `x-original-name` | Original filename before sanitization | `My Cat Photo (1).jpg` |
| `x-upload-batch` | Batch upload identifier | `batch_abc123` |
| `x-created-by` | User who uploaded | `admin` |
| `x-image-dimensions` | Image width x height | `1920x1080` |

---

## 4. Folder Representation Strategy

### **4.1 Empty Folder Handling**

Since R2 is object storage, folders don't exist without files. We use placeholder files:

#### **Placeholder Object Pattern**
```
folder-path/.folder-placeholder
```

#### **Placeholder Content**
```javascript
{
  key: "categories/animals/mammals/.folder-placeholder",
  content: "This file maintains the folder structure",
  httpMetadata: {
    contentType: "text/plain",
    cacheControl: "no-cache"
  },
  customMetadata: {
    "x-folder-placeholder": "true",
    "x-created-at": "2024-01-15T10:30:00Z"
  }
}
```

### **4.2 Folder Listing Algorithm**

#### **List Immediate Children (Depth = 1)**
```javascript
// Get folders and files in specific directory
const listFolder = async (path, includeFiles = true) => {
  const prefix = path ? `${path}/` : '';
  
  const result = await bucket.list({
    prefix: prefix,
    delimiter: '/', // This groups by "folders"
    limit: 1000
  });
  
  return {
    folders: result.delimitedPrefixes?.map(p => p.replace(/\/$/, '')),
    files: includeFiles ? result.objects?.filter(obj => 
      !obj.key.endsWith('/.folder-placeholder')
    ) : []
  };
};
```

#### **List Deep Hierarchy (Depth > 1)**
```javascript
// Get nested folder structure
const listDeepFolder = async (path, maxDepth = 5) => {
  const prefix = path ? `${path}/` : '';
  
  const result = await bucket.list({
    prefix: prefix,
    // No delimiter = get all nested objects
    limit: 1000
  });
  
  // Build tree structure from flat object list
  return buildFolderTree(result.objects, maxDepth);
};
```

---

## 5. Key Migration Strategies

### **5.1 Flat to Hierarchical Migration**

For migrating existing flat folder structure to nested:

#### **Current State**
```
animals/cat1.jpg
animals/cat2.jpg
vehicles/car1.jpg
ui-icons/arrow.svg
```

#### **Target State**
```
categories/animals/cats/persian.jpg
categories/animals/cats/siamese.jpg
categories/vehicles/cars/sedan.jpg
ui-elements/icons/navigation/arrow.svg
```

#### **Migration Algorithm**
```javascript
const migrateToHierarchy = async (bucket) => {
  // 1. List all current objects
  const allObjects = await bucket.list({ limit: 10000 });
  
  // 2. Define migration mapping
  const migrationMap = {
    'animals/': 'categories/animals/',
    'vehicles/': 'categories/vehicles/',
    'ui-icons/': 'ui-elements/icons/'
  };
  
  // 3. Copy objects to new keys
  for (const obj of allObjects.objects) {
    const newKey = applyMigrationRules(obj.key, migrationMap);
    if (newKey !== obj.key) {
      await copyObject(bucket, obj.key, newKey);
      await deleteObject(bucket, obj.key);
    }
  }
};
```

### **5.2 Backup and Rollback Strategy**

#### **Pre-Migration Backup**
```javascript
const createBackup = async (bucket) => {
  const timestamp = new Date().toISOString();
  const backupKey = `.system/backups/${timestamp}/`;
  
  // Copy all objects to backup location
  const allObjects = await bucket.list();
  for (const obj of allObjects.objects) {
    const backupObjectKey = `${backupKey}${obj.key}`;
    await copyObject(bucket, obj.key, backupObjectKey);
  }
};
```

---

## 6. Performance Optimization Patterns

### **6.1 Efficient Listing Patterns**

#### **Pagination Strategy**
```javascript
const paginatedList = async (bucket, path, options = {}) => {
  const {
    limit = 100,
    cursor = null,
    includeFiles = true
  } = options;
  
  const result = await bucket.list({
    prefix: path ? `${path}/` : '',
    delimiter: '/',
    limit: limit,
    cursor: cursor
  });
  
  return {
    folders: result.delimitedPrefixes || [],
    files: includeFiles ? result.objects || [] : [],
    truncated: result.truncated,
    cursor: result.cursor
  };
};
```

#### **Parallel Folder Loading**
```javascript
const loadFolderHierarchy = async (bucket, paths) => {
  // Load multiple folder contents in parallel
  const promises = paths.map(path => 
    listFolder(bucket, path, { includeFiles: false })
  );
  
  const results = await Promise.all(promises);
  
  return paths.reduce((acc, path, index) => {
    acc[path] = results[index];
    return acc;
  }, {});
};
```

### **6.2 Caching Strategies**

#### **Folder Content Caching**
```javascript
// Cache folder listings to reduce R2 API calls
const folderCache = new Map();

const getCachedFolderContents = async (bucket, path) => {
  const cacheKey = `folder:${path}`;
  const cached = folderCache.get(cacheKey);
  
  if (cached && !isCacheExpired(cached.timestamp)) {
    return cached.data;
  }
  
  const data = await listFolder(bucket, path);
  folderCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
};
```

---

## 7. Data Consistency Patterns

### **7.1 Atomic Folder Operations**

#### **Safe Folder Creation**
```javascript
const createFolderAtomic = async (bucket, folderPath) => {
  const placeholderKey = `${folderPath}/.folder-placeholder`;
  
  try {
    // Check if folder already exists
    const existing = await bucket.head(placeholderKey);
    if (existing) {
      throw new Error('Folder already exists');
    }
  } catch (error) {
    if (error.name !== 'NotFound') {
      throw error;
    }
  }
  
  // Create placeholder
  await bucket.put(placeholderKey, 'Folder placeholder', {
    httpMetadata: {
      contentType: 'text/plain'
    }
  });
};
```

#### **Safe Folder Rename**
```javascript
const renameFolderAtomic = async (bucket, oldPath, newPath) => {
  // 1. List all objects in old folder
  const objects = await bucket.list({
    prefix: `${oldPath}/`,
    limit: 1000
  });
  
  // 2. Copy all objects to new location
  const copyPromises = objects.objects.map(obj => {
    const newKey = obj.key.replace(`${oldPath}/`, `${newPath}/`);
    return copyObject(bucket, obj.key, newKey);
  });
  
  await Promise.all(copyPromises);
  
  // 3. Delete old objects only after all copies succeed
  const deletePromises = objects.objects.map(obj => 
    bucket.delete(obj.key)
  );
  
  await Promise.all(deletePromises);
};
```

---

## 8. Search Index Schema

### **8.1 Search Metadata Structure**

For future search functionality:

```javascript
const searchMetadata = {
  "key": "categories/animals/cats/persian.jpg",
  "searchTerms": [
    "persian", "cat", "animal", "mammal", 
    "pet", "feline", "categories"
  ],
  "path_segments": ["categories", "animals", "cats"],
  "file_type": "image",
  "file_extension": "jpg",
  "dimensions": "1920x1080",
  "file_size_mb": 0.24,
  "upload_date": "2024-01-15",
  "tags": ["animal", "pet", "persian-cat"]
};
```

### **8.2 Search Index Pattern**

```javascript
// Create search index entries for efficient querying
const indexObject = async (bucket, objectKey, metadata) => {
  const indexKey = `.search-index/${objectKey.replace(/\//g, '_')}`;
  
  await bucket.put(indexKey, JSON.stringify({
    originalKey: objectKey,
    searchMetadata: metadata,
    indexedAt: new Date().toISOString()
  }));
};
```

---

## 9. Backup and Recovery Schema

### **9.1 Backup Structure**

```
.system/
├── backups/
│   ├── 2024-01-15T10-30-00Z/
│   │   ├── manifest.json
│   │   └── data/
│   │       ├── categories/
│   │       └── ui-elements/
│   └── 2024-01-14T10-30-00Z/
├── migrations/
│   ├── v1-to-v2/
│   │   ├── migration-log.json
│   │   └── rollback-plan.json
└── temp/
    └── upload-sessions/
```

### **9.2 Manifest Schema**

```javascript
{
  "backup_id": "backup_2024-01-15T10-30-00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "schema_version": "1.0",
  "total_objects": 2500,
  "total_size_bytes": 524288000,
  "folder_structure": {
    "categories": {
      "object_count": 1200,
      "subfolders": ["animals", "vehicles", "technology"]
    },
    "ui-elements": {
      "object_count": 800,
      "subfolders": ["icons", "buttons", "backgrounds"]
    }
  },
  "integrity_hash": "sha256:abc123def456...",
  "backup_type": "full"
}
```

---

*Document Version*: 1.0  
*Created*: Phase 1 - Data Schema Design  
*Last Updated*: Initial creation