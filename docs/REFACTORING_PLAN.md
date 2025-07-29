# R2 Image Browser - Refactoring Plan

## Overview
This document outlines the structured approach to address critical issues identified in the code review conducted on January 29, 2025.

## Phase 1: Critical Bug Fixes (Priority: CRITICAL)

### 1.1 Fix Pagination in Folder Operations
**Issue**: Folder operations (rename, move, delete) only handle first 1000 files, causing incomplete operations.

**Affected Functions**:
- `handleRenameFolder` (line 1357)
- `handleMoveFolder` (line 1120)
- `handleDeleteFolder` (line 1537)

**Solution**:
- Implement pagination loops similar to `handleDeleteFolderRecursive`
- Add progress tracking for large operations
- Implement transaction-like behavior (all or nothing)

**Implementation Steps**:
1. Create a shared pagination utility function
2. Update each operation to use pagination
3. Add error recovery mechanisms
4. Test with folders containing >1000 files

## Phase 2: Code Consolidation (Priority: HIGH)

### 2.1 Consolidate Duplicate Functions
**Issue**: Multiple implementations of the same functions across files.

**Functions to Consolidate**:
1. `validateAndSanitizePath`:
   - Currently in: `index.js`, `utils.js`, `worker-functions.js`
   - Target: Single implementation in `utils.js`

2. `formatSize`:
   - Currently in: `FolderManager.vue`, `FolderNavigator.vue`, `BrowserView.vue`
   - Target: Single implementation in `utils.js`

3. `buildFolderHierarchy` & `extractFilesFromObjects`:
   - Currently in: `index.js`, `utils.js`
   - Target: Single implementation in `utils.js`

**Implementation Steps**:
1. Review all implementations and create the best version
2. Move to `utils.js` with proper exports
3. Update all imports across the codebase
4. Remove duplicate implementations
5. Test all affected components

### 2.2 Create API Client Module
**Issue**: Repeated fetch logic across components.

**Solution**:
- Create `src/api/client.js` for centralized API calls
- Handle authentication headers automatically
- Implement consistent error handling
- Add request/response interceptors

## Phase 3: Performance Optimization (Priority: MEDIUM)

### 3.1 Fix N+1 Query Problem in FolderManager
**Issue**: FolderManager makes separate API call for each folder's stats.

**Solution**:
- Modify `/api/folders` endpoint to include `fileCount` and `totalSize`
- Update backend to calculate stats during folder listing
- Remove client-side stats fetching loop

**Implementation Steps**:
1. Update `handleListFolders` to calculate stats
2. Modify response structure to include stats
3. Update FolderManager to use provided stats
4. Test performance improvement

## Phase 4: Code Quality Improvements (Priority: MEDIUM)

### 4.1 Replace alert() with Toast Notifications
**Issue**: Using browser alerts disrupts UX.

**Solution**:
- Create a shared toast composable
- Replace all alert() calls with toast notifications
- Implement consistent error messaging

**Affected Files**:
- `FolderManager.vue`
- `AdminView.vue`

### 4.2 Remove Orphaned Code
**Issue**: Unused code increases maintenance burden.

**Files/Code to Remove**:
- `worker-functions.js` (if not used in tests)
- Unused methods in `BrowserView.vue` (loadFolders, loadImages)
- Unused data properties in `BrowserView.vue`

## Testing Strategy

### Unit Tests
- Test pagination utilities with edge cases
- Test consolidated utility functions
- Test API client error handling

### Integration Tests
- Test folder operations with >1000 files
- Test performance improvements
- Test error recovery scenarios

### Manual Testing Checklist
- [ ] Rename folder with 2000+ files
- [ ] Move folder with nested structure
- [ ] Delete large folder
- [ ] Verify toast notifications
- [ ] Check performance metrics

## Success Metrics
1. All folder operations handle unlimited files correctly
2. No duplicate code across codebase
3. FolderManager loads 50% faster
4. Zero browser alerts in application
5. Reduced bundle size from removed code

## Timeline
- Phase 1: 2-3 hours (Critical - Do First)
- Phase 2: 2-3 hours (High Priority)
- Phase 3: 1-2 hours (Medium Priority)
- Phase 4: 1 hour (Quality of Life)

Total Estimated Time: 6-9 hours

## Rollback Plan
- Git commits after each phase
- Feature flags for major changes
- Maintain backward compatibility
- Test in staging before production

---
*Created: January 29, 2025*
*Last Updated: January 29, 2025*