# API Design: Nested Folders & Drag-and-Drop

## Overview

This document specifies the API endpoints, request/response formats, and integration patterns for the enhanced hierarchical folder management system.

---

## Base Configuration

### **Base URL**
```
Production: https://iconbrowser.jezweb.com
Development: https://r2-image-browser.webfonts.workers.dev
```

### **Authentication**
All API endpoints require HTTP Basic Authentication:
```
Authorization: Basic <base64(username:password)>
Default: username=jezweb, password=iconbrowser
```

### **Response Format**
All API responses follow a consistent JSON structure:
```json
{
  "success": boolean,
  "message": string (optional),
  "error": string (optional, when success=false),
  "data": object (optional, response data)
}
```

---

## Enhanced Folder Listing API

### **GET /api/folders**
Enhanced folder listing with hierarchical support

#### **Query Parameters**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | No | `""` | Parent folder path (empty = root) |
| `depth` | integer | No | `1` | How many levels deep to return (1 = immediate children only) |
| `include_files` | boolean | No | `false` | Include files in response along with folders |
| `limit` | integer | No | `1000` | Maximum items to return |
| `offset` | integer | No | `0` | Pagination offset |

#### **Request Examples**
```http
# Get root level folders only
GET /api/folders

# Get immediate children of a specific folder
GET /api/folders?path=categories/animals

# Get files and folders in a specific path
GET /api/folders?path=categories/animals&include_files=true

# Get nested structure (2 levels deep)
GET /api/folders?path=categories&depth=2

# Paginated results
GET /api/folders?path=ui-icons&limit=50&offset=100
```

#### **Response Format**
```json
{
  "success": true,
  "data": {
    "path": "categories/animals",
    "folders": [
      {
        "name": "mammals",
        "path": "categories/animals/mammals",
        "type": "folder",
        "fileCount": 45,
        "totalSize": 2048576,
        "lastModified": "2024-01-15T10:30:00Z",
        "children": [] // Only populated when depth > 1
      }
    ],
    "files": [
      {
        "name": "overview.jpg",
        "path": "categories/animals/overview.jpg",
        "type": "file",
        "size": 102400,
        "contentType": "image/jpeg",
        "lastModified": "2024-01-15T10:30:00Z",
        "url": "https://icons.jezweb.com/categories/animals/overview.jpg"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 1000,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

#### **Error Responses**
```json
// Invalid path
{
  "success": false,
  "error": "Invalid folder path: contains illegal characters"
}

// Path not found
{
  "success": false,
  "error": "Folder not found: categories/nonexistent"
}
```

---

## Nested Folder Management API

### **POST /api/admin/folders/nested**
Create nested folder structure

#### **Request Body**
```json
{
  "path": "categories/animals/mammals/cats",
  "createParents": true
}
```

#### **Parameters**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Full folder path to create |
| `createParents` | boolean | No | Auto-create parent folders if they don't exist |

#### **Response**
```json
{
  "success": true,
  "message": "Folder created successfully",
  "data": {
    "path": "categories/animals/mammals/cats",
    "createdPaths": [
      "categories/animals/mammals",
      "categories/animals/mammals/cats"
    ]
  }
}
```

### **PUT /api/admin/folders/move**
Move folder to new location

#### **Request Body**
```json
{
  "sourcePath": "categories/animals/mammals",
  "targetPath": "wildlife/land-animals/mammals",
  "createParents": true
}
```

#### **Response**
```json
{
  "success": true,
  "message": "Moved 45 files from 'categories/animals/mammals' to 'wildlife/land-animals/mammals'",
  "data": {
    "movedFiles": 45,
    "movedFolders": 3,
    "failedFiles": 0,
    "newPath": "wildlife/land-animals/mammals"
  }
}
```

### **DELETE /api/admin/folders/recursive**
Delete folder and all contents recursively

#### **Query Parameters**
```http
DELETE /api/admin/folders/recursive?path=categories/animals/mammals
```

#### **Response**
```json
{
  "success": true,
  "message": "Deleted 45 files and 3 folders from 'categories/animals/mammals'",
  "data": {
    "deletedFiles": 45,
    "deletedFolders": 3,
    "totalSize": 10485760
  }
}
```

---

## Batch Upload API

### **POST /api/admin/upload/batch**
Upload multiple files maintaining folder structure

#### **Request Format**
`Content-Type: multipart/form-data`

#### **Form Fields**
| Field | Type | Description |
|-------|------|-------------|
| `files[]` | File[] | Array of files to upload |
| `folderStructure` | JSON string | Mapping of files to their target paths |
| `targetPath` | string | Base path for upload (optional) |
| `conflictResolution` | string | How to handle conflicts: `skip`, `rename`, `overwrite` |

#### **Request Example**
```javascript
const formData = new FormData();

// Add files
formData.append('files', file1);
formData.append('files', file2);
formData.append('files', file3);

// Add folder structure mapping
const structure = {
  "file1.jpg": "categories/animals/cats/persian.jpg",
  "file2.jpg": "categories/animals/dogs/golden.jpg",
  "file3.svg": "ui-icons/navigation/arrow-left.svg"
};
formData.append('folderStructure', JSON.stringify(structure));
formData.append('targetPath', 'assets');
formData.append('conflictResolution', 'rename');
```

#### **Response**
```json
{
  "success": true,
  "message": "Uploaded 3 files successfully",
  "data": {
    "totalFiles": 3,
    "successfulUploads": 3,
    "failedUploads": 0,
    "results": [
      {
        "originalName": "file1.jpg",
        "finalPath": "assets/categories/animals/cats/persian.jpg",
        "url": "https://icons.jezweb.com/assets/categories/animals/cats/persian.jpg",
        "size": 102400,
        "status": "success"
      },
      {
        "originalName": "file2.jpg",
        "finalPath": "assets/categories/animals/dogs/golden-1.jpg",
        "url": "https://icons.jezweb.com/assets/categories/animals/dogs/golden-1.jpg",
        "size": 156789,
        "status": "success",
        "note": "Renamed due to conflict"
      }
    ]
  }
}
```

---

## Chunked Upload API

### **POST /api/admin/upload/chunk/init**
Initialize chunked upload session

#### **Request Body**
```json
{
  "totalFiles": 1000,
  "totalSize": 104857600,
  "folderStructure": {
    "categories/animals/": 500,
    "categories/vehicles/": 300,
    "ui-icons/": 200
  }
}
```

#### **Response**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_abc123def456",
    "chunkSize": 50,
    "estimatedChunks": 20
  }
}
```

### **POST /api/admin/upload/chunk**
Upload single chunk of files

#### **Request Body**
```javascript
// Form data with:
// - uploadId
// - chunkNumber
// - files[]
// - chunkStructure (JSON)
```

#### **Response**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_abc123def456",
    "chunkNumber": 1,
    "processedFiles": 50,
    "failedFiles": 0,
    "progress": {
      "totalFiles": 1000,
      "completedFiles": 50,
      "percentage": 5.0
    }
  }
}
```

### **POST /api/admin/upload/chunk/complete**
Finalize chunked upload

#### **Request Body**
```json
{
  "uploadId": "upload_abc123def456"
}
```

#### **Response**
```json
{
  "success": true,
  "message": "Upload completed successfully",
  "data": {
    "totalFiles": 1000,
    "successfulUploads": 995,
    "failedUploads": 5,
    "totalSize": 104857600,
    "duration": 180,
    "averageSpeed": "582 KB/s"
  }
}
```

---

## Search API

### **GET /api/search**
Search files across folder hierarchy

#### **Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `path` | string | No | Limit search to specific folder |
| `type` | string | No | File type filter (`image`, `svg`, etc.) |
| `size_min` | integer | No | Minimum file size in bytes |
| `size_max` | integer | No | Maximum file size in bytes |
| `limit` | integer | No | Maximum results (default: 100) |

#### **Request Examples**
```http
# Search for "cat" in all folders
GET /api/search?q=cat

# Search within specific folder
GET /api/search?q=arrow&path=ui-icons/navigation

# Search with filters
GET /api/search?q=logo&type=svg&size_min=1024
```

#### **Response**
```json
{
  "success": true,
  "data": {
    "query": "cat",
    "results": [
      {
        "name": "persian-cat.jpg",
        "path": "categories/animals/cats/persian-cat.jpg",
        "url": "https://icons.jezweb.com/categories/animals/cats/persian-cat.jpg",
        "size": 102400,
        "type": "image/jpeg",
        "lastModified": "2024-01-15T10:30:00Z",
        "relevance": 0.95
      }
    ],
    "totalResults": 15,
    "searchTime": 0.045
  }
}
```

---

## Statistics API

### **GET /api/admin/stats/hierarchy**
Get detailed statistics about folder hierarchy

#### **Response**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalFiles": 2500,
      "totalFolders": 150,
      "totalSize": 524288000,
      "maxDepth": 6,
      "averageDepth": 3.2
    },
    "folderStats": [
      {
        "path": "categories",
        "fileCount": 1200,
        "folderCount": 45,
        "totalSize": 251658240,
        "depth": 1
      }
    ],
    "depthDistribution": {
      "1": 15,
      "2": 45,
      "3": 60,
      "4": 25,
      "5": 5
    },
    "fileTypeDistribution": {
      "jpg": 1500,
      "png": 800,
      "svg": 200
    }
  }
}
```

---

## Error Handling

### **Standard Error Codes**

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_PATH` | Folder path contains invalid characters |
| 400 | `PATH_TOO_LONG` | Folder path exceeds maximum length |
| 400 | `INVALID_FILE_TYPE` | File type not supported |
| 400 | `FILE_TOO_LARGE` | File exceeds size limit |
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `FOLDER_NOT_FOUND` | Specified folder does not exist |
| 409 | `FOLDER_EXISTS` | Folder already exists at specified path |
| 413 | `UPLOAD_TOO_LARGE` | Total upload size exceeds limit |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `UPLOAD_FAILED` | File upload failed |
| 500 | `OPERATION_FAILED` | Folder operation failed |

### **Error Response Format**
```json
{
  "success": false,
  "error": "INVALID_PATH",
  "message": "Folder path contains invalid characters: '../../../'",
  "details": {
    "invalidCharacters": [".", "."],
    "suggestedPath": "categories/animals"
  }
}
```

---

## Rate Limiting

### **Limits per IP Address**
- **General API**: 1000 requests per hour
- **Upload endpoints**: 100 requests per hour
- **Batch uploads**: 10 requests per hour
- **Search**: 200 requests per hour

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640995200
```

---

## WebSocket API (Future Enhancement)

### **Connection**
```javascript
const ws = new WebSocket('wss://iconbrowser.jezweb.com/ws');
```

### **Upload Progress Streaming**
```json
{
  "type": "upload_progress",
  "uploadId": "upload_abc123def456",
  "data": {
    "completedFiles": 150,
    "totalFiles": 1000,
    "currentFile": "categories/animals/cats/siamese.jpg",
    "percentage": 15.0,
    "speed": "1.2 MB/s",
    "eta": 420
  }
}
```

### **Folder Structure Updates**
```json
{
  "type": "folder_created",
  "data": {
    "path": "categories/vehicles/motorcycles",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## API Versioning

### **Version Strategy**
- **Current Version**: `v1`
- **Header**: `API-Version: v1`
- **URL Path**: `/api/v1/folders` (future)

### **Backward Compatibility**
- Existing endpoints remain unchanged
- New functionality added as separate endpoints
- Deprecation notices provided 6 months before removal

---

## Security Considerations

### **Input Validation**
- All paths validated against directory traversal attacks
- File names sanitized for special characters
- File type validation on upload
- Size limits enforced

### **Authentication**
- HTTP Basic Auth for all endpoints
- Consider JWT tokens for future enhancement
- Rate limiting per authenticated user

### **CORS Configuration**
```javascript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, API-Version'
}
```

---

## Implementation Priority

### **Phase 1: Core Functionality**
1. Enhanced `/api/folders` with hierarchical support
2. `/api/admin/folders/nested` for folder creation
3. `/api/admin/upload/batch` for folder uploads

### **Phase 2: Advanced Operations**
1. `/api/admin/folders/move` for folder reorganization
2. `/api/admin/folders/recursive` for deletion
3. `/api/search` for content discovery

### **Phase 3: Performance & UX**
1. Chunked upload endpoints
2. WebSocket streaming
3. Advanced statistics API

---

*Document Version*: 1.0  
*Created*: Phase 1 - API Design  
*Last Updated*: Initial creation