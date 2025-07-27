# R2 Image Browser Test Suite

This comprehensive test suite covers all aspects of the hierarchical folder functionality implemented in the R2 Image Browser.

## Test Structure

```
tests/
├── setup.js                           # Test environment setup and mocks
├── api/                               # Backend API tests
│   ├── folders.test.js                # Folder listing and hierarchy tests
│   └── upload.test.js                 # File upload and batch processing tests
├── components/                        # Vue component unit tests
│   ├── FolderNavigator.test.js        # Main navigation component tests
│   └── FolderDropZone.test.js         # Drag & drop upload component tests
├── integration/                       # End-to-end workflow tests
│   └── upload-workflow.test.js        # Complete upload and navigation workflows
├── browser/                           # Browser compatibility tests
│   └── compatibility.test.js          # Cross-browser feature detection
└── README.md                          # This file
```

## Test Coverage

### 🔧 Backend API Tests (`api/`)

**Folder Management (`folders.test.js`)**
- ✅ Path validation and sanitization
- ✅ Hierarchical folder structure building
- ✅ Folder listing with depth control
- ✅ Pagination support
- ✅ File inclusion options
- ✅ Path filtering
- ✅ Security validation (path traversal prevention)

**Upload Processing (`upload.test.js`)**
- ✅ Single file upload validation
- ✅ File type and size restrictions
- ✅ Conflict resolution strategies (rename, skip, overwrite)
- ✅ Batch upload processing
- ✅ Folder structure preservation
- ✅ Error handling for invalid uploads
- ✅ Path sanitization for security

### 🎨 Component Tests (`components/`)

**FolderNavigator (`FolderNavigator.test.js`)**
- ✅ Component initialization and rendering
- ✅ Breadcrumb navigation
- ✅ Navigation controls (back, forward, refresh)
- ✅ Tree view toggle and management
- ✅ Folder content loading and display
- ✅ View mode switching (grid/list)
- ✅ Sorting functionality
- ✅ File and folder operations
- ✅ Context menu interactions
- ✅ Computed properties and utilities

**FolderDropZone (`FolderDropZone.test.js`)**
- ✅ Drag and drop event handling
- ✅ File validation and processing
- ✅ Folder structure building
- ✅ Upload progress tracking
- ✅ Browser capability detection
- ✅ File selection methods
- ✅ Upload controls and configuration
- ✅ Dynamic UI updates
- ✅ Error handling

### 🔄 Integration Tests (`integration/`)

**Upload Workflow (`upload-workflow.test.js`)**
- ✅ Complete hierarchical folder upload flow
- ✅ Mixed upload results handling
- ✅ File conflict resolution workflows
- ✅ Folder navigation after upload
- ✅ Pagination in large folder structures
- ✅ Error handling and edge cases
- ✅ Performance with large batch uploads
- ✅ Security validation integration

### 🌐 Browser Compatibility (`browser/`)

**Compatibility Tests (`compatibility.test.js`)**
- ✅ Feature detection across browsers
- ✅ Chrome/Edge advanced drag-drop support
- ✅ Firefox fallback mechanisms
- ✅ Safari webkitdirectory support
- ✅ Progressive enhancement strategies
- ✅ Touch device adaptations
- ✅ Error handling for missing APIs
- ✅ Performance optimizations
- ✅ Accessibility features

## Test Environment

### Setup and Mocks (`setup.js`)

The test environment includes comprehensive mocks for:

- **Cloudflare Workers Environment**
  - Request/Response objects
  - R2 bucket operations (put, get, delete, list)
  - Environment bindings

- **Browser APIs**
  - File API and FileReader
  - Drag and Drop APIs (DataTransfer, DataTransferItem)
  - Clipboard API
  - DOM elements and events

- **Vue Test Utils**
  - Component mounting and testing
  - Event simulation
  - Prop and emission testing

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with UI
```bash
npm run test:ui
```

### Run Tests Once (CI Mode)
```bash
npm run test:run
```

### Generate Coverage Report
```bash
npm run test:coverage
```

## Test Scenarios

### 🔒 Security Testing
- Path traversal attack prevention
- File type validation
- Size limit enforcement
- Input sanitization

### 📁 Folder Operations
- Nested folder creation
- Hierarchical navigation
- Recursive operations
- Conflict resolution

### 📤 Upload Workflows
- Single file upload
- Batch upload processing
- Folder structure preservation
- Progress tracking

### 🎯 Browser Support
- Feature detection
- Progressive enhancement
- Fallback mechanisms
- Performance optimization

### ♿ Accessibility
- Keyboard navigation
- Screen reader support
- ARIA attributes
- Focus management

## Mock Data Structures

### R2 Bucket Mock
```javascript
// Simulates Cloudflare R2 bucket operations
const mockR2Bucket = {
  objects: new Map(),
  put(key, data, options),
  get(key),
  delete(key),
  list(options),
  clear(),
  seed(data)
}
```

### File Upload Mock
```javascript
// Creates mock File objects for testing
const createMockFile = (name, size, type) => ({
  name,
  size,
  type,
  lastModified: Date.now(),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(size))
})
```

### Form Data Mock
```javascript
// Creates mock FormData for upload testing
const createMockFormData = (files, folderStructure) => {
  // Returns FormData-like object with getAll() method
}
```

## Test Data

### Sample Folder Structures
```
categories/
├── animals/
│   ├── cats/
│   │   ├── persian.jpg
│   │   └── siamese.jpg
│   ├── dogs/
│   │   └── golden.jpg
│   └── birds/
│       └── parrot.jpg
├── nature/
│   ├── mountains/
│   │   └── alps.jpg
│   └── oceans/
│       └── pacific.jpg
└── icons/
    └── social/
        ├── facebook.svg
        └── twitter.svg
```

## Performance Benchmarks

The test suite includes performance tests to ensure:

- ✅ Large batch uploads (100+ files) complete within 5 seconds
- ✅ Folder navigation with 1000+ items responds quickly
- ✅ Memory usage remains reasonable with large file sets
- ✅ UI remains responsive during operations

## Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| webkitGetAsEntry | ✅ | ❌ | ✅ | ✅ |
| webkitdirectory | ✅ | ✅ | ✅ | ✅ |
| Drag & Drop Folders | ✅ | ❌ | ✅ | ✅ |
| File API | ✅ | ✅ | ✅ | ✅ |
| Clipboard API | ✅ | ✅ | ✅ | ✅ |

## Continuous Integration

The test suite is designed for CI/CD integration:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:run

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
```

## Contributing

When adding new features:

1. Add corresponding test cases
2. Ensure all existing tests pass
3. Maintain test coverage above 90%
4. Update this README if needed

## Test Philosophy

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test complete workflows and component interactions
- **Browser Tests**: Ensure cross-browser compatibility and progressive enhancement
- **Performance Tests**: Validate performance under realistic load conditions
- **Security Tests**: Verify protection against common vulnerabilities