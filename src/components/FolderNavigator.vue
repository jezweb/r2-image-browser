<template>
  <div class="folder-navigator">
    <!-- Navigation Header -->
    <div class="navigator-header">
      <!-- Breadcrumb Navigation -->
      <nav class="breadcrumb-nav" aria-label="Folder path">
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <button 
              @click="navigateToPath('')"
              :class="['breadcrumb-btn', { active: currentPath === '' }]"
              aria-label="Go to root folder"
            >
              <i class="pi pi-home"></i>
              <span class="breadcrumb-text">Root</span>
            </button>
          </li>
          
          <li 
            v-for="(segment, index) in pathSegments" 
            :key="index"
            class="breadcrumb-item"
          >
            <i class="pi pi-angle-right breadcrumb-separator"></i>
            <button 
              @click="navigateToSegment(index)"
              :class="['breadcrumb-btn', { active: index === pathSegments.length - 1 }]"
              :aria-label="`Go to ${segment} folder`"
            >
              <span class="breadcrumb-text">{{ segment }}</span>
            </button>
          </li>
        </ol>
      </nav>
      
      <!-- Navigation Controls -->
      <div class="nav-controls">
        <button 
          @click="goBack"
          :disabled="!canGoBack"
          class="nav-btn back-btn"
          title="Go back"
        >
          <i class="pi pi-arrow-left"></i>
        </button>
        
        <button 
          @click="goForward"
          :disabled="!canGoForward"
          class="nav-btn forward-btn"
          title="Go forward"
        >
          <i class="pi pi-arrow-right"></i>
        </button>
        
        <button 
          @click="refreshCurrentFolder"
          :disabled="isLoading"
          class="nav-btn refresh-btn"
          title="Refresh"
        >
          <i :class="isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"></i>
        </button>
        
        <button 
          @click="toggleTreeView"
          :class="['nav-btn', 'tree-toggle-btn', { active: showTreeView }]"
          title="Toggle tree view"
        >
          <i class="pi pi-sitemap"></i>
        </button>
      </div>
    </div>
    
    <!-- Path Input (for advanced users) -->
    <div v-if="showPathInput" class="path-input-container">
      <div class="path-input-group">
        <i class="pi pi-folder-open path-icon"></i>
        <input 
          v-model="pathInputValue"
          @keyup.enter="navigateToInputPath"
          @blur="hidePathInput"
          ref="pathInput"
          type="text"
          class="path-input"
          placeholder="Enter folder path (e.g., categories/animals/cats)"
          aria-label="Enter folder path"
        >
        <button @click="navigateToInputPath" class="go-btn">
          <i class="pi pi-arrow-right"></i>
        </button>
      </div>
    </div>
    
    <!-- Main Content Area -->
    <div class="navigator-content">
      <!-- Tree View Sidebar -->
      <div v-if="showTreeView" class="tree-sidebar">
        <div class="tree-header">
          <h3>Folder Tree</h3>
          <button @click="expandAll" class="expand-all-btn" title="Expand all folders">
            <i class="pi pi-plus-circle"></i>
          </button>
          <button @click="collapseAll" class="collapse-all-btn" title="Collapse all folders">
            <i class="pi pi-minus-circle"></i>
          </button>
        </div>
        
        <div class="tree-content">
          <div v-if="isLoadingTree" class="tree-loading">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Loading folder tree...</span>
          </div>
          
          <div v-else-if="folderTree.length === 0" class="tree-empty">
            <i class="pi pi-folder"></i>
            <span>No folders found</span>
          </div>
          
          <FolderTreeView
            v-else
            :folders="folderTree"
            :current-path="currentPath"
            :expanded-folders="expandedFolders"
            @navigate="navigateToPath"
            @toggle-expand="toggleFolderExpansion"
          />
        </div>
      </div>
      
      <!-- Main Folder Content -->
      <div class="folder-content">
        <!-- Current Folder Info -->
        <div class="folder-info">
          <div class="folder-stats">
            <span class="stat-item">
              <i class="pi pi-folder"></i>
              {{ folderCount }} folders
            </span>
            <span class="stat-item">
              <i class="pi pi-file"></i>
              {{ fileCount }} files
            </span>
            <span v-if="totalSize > 0" class="stat-item">
              <i class="pi pi-database"></i>
              {{ formatSize(totalSize) }}
            </span>
          </div>
          
          <div class="view-controls">
            <div class="view-mode-toggle">
              <button 
                @click="setViewMode('grid')"
                :class="['view-btn', { active: viewMode === 'grid' }]"
                title="Grid view"
              >
                <i class="pi pi-th-large"></i>
              </button>
              <button 
                @click="setViewMode('list')"
                :class="['view-btn', { active: viewMode === 'list' }]"
                title="List view"
              >
                <i class="pi pi-list"></i>
              </button>
            </div>
            
            <select v-model="sortBy" class="sort-select" aria-label="Sort by">
              <option value="name">Name</option>
              <option value="date">Date Modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
            
            <button 
              @click="toggleSortOrder"
              class="sort-order-btn"
              :title="sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'"
            >
              <i :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up' : 'pi pi-sort-amount-down'"></i>
            </button>
          </div>
        </div>
        
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-content">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Loading folder contents...</span>
        </div>
        
        <!-- Error State -->
        <div v-else-if="error" class="error-content">
          <i class="pi pi-exclamation-triangle"></i>
          <h3>Error Loading Folder</h3>
          <p>{{ error }}</p>
          <button @click="refreshCurrentFolder" class="retry-btn">
            <i class="pi pi-refresh"></i>
            Try Again
          </button>
        </div>
        
        <!-- Folder and File Listing -->
        <div v-else class="content-listing">
          <!-- Folders -->
          <div v-if="sortedFolders.length > 0" class="folders-section">
            <h4 class="section-title">
              <i class="pi pi-folder"></i>
              Folders ({{ sortedFolders.length }})
            </h4>
            
            <div :class="['folders-grid', `view-${viewMode}`]">
              <div 
                v-for="folder in sortedFolders" 
                :key="folder.path"
                class="folder-item"
                @click="navigateToPath(folder.path)"
                @keyup.enter="navigateToPath(folder.path)"
                tabindex="0"
                role="button"
                :aria-label="`Open ${folder.name} folder`"
              >
                <div class="item-icon">
                  <FolderThumbnailGrid
                    v-if="folder.previewImages && folder.previewImages.length > 0"
                    :preview-images="folder.previewImages"
                    :folder-name="folder.name"
                    :size="viewMode === 'list' ? 'small' : 'medium'"
                    :loading="isLoading"
                  />
                  <i v-else class="pi pi-folder folder-icon"></i>
                </div>
                <div class="item-info">
                  <span class="item-name">{{ folder.name }}</span>
                  <span v-if="folder.fileCount !== undefined" class="item-meta">
                    {{ folder.fileCount }} items
                  </span>
                </div>
                <div class="item-actions">
                  <button 
                    @click.stop="showFolderMenu(folder, $event)"
                    class="action-btn"
                    :aria-label="`Options for ${folder.name}`"
                  >
                    <i class="pi pi-ellipsis-v"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Files -->
          <div v-if="sortedFiles.length > 0" class="files-section">
            <h4 class="section-title">
              <i class="pi pi-file"></i>
              Files ({{ sortedFiles.length }})
            </h4>
            
            <div :class="['files-grid', `view-${viewMode}`]">
              <div 
                v-for="file in sortedFiles" 
                :key="file.path"
                class="file-item"
                @click="selectFile(file)"
                tabindex="0"
                role="button"
                :aria-label="`Select ${file.name}`"
              >
                <div class="item-icon">
                  <img 
                    v-if="file.url && isImageFile(file.name)"
                    :src="file.url" 
                    :alt="file.name"
                    class="file-thumbnail"
                    loading="lazy"
                    @error="handleImageError"
                  >
                  <i v-else class="pi pi-file file-icon"></i>
                </div>
                <div class="item-info">
                  <span class="item-name">{{ file.name }}</span>
                  <div class="item-meta">
                    <span class="file-size">{{ formatSize(file.size) }}</span>
                    <span v-if="file.lastModified" class="file-date">
                      {{ formatDate(file.lastModified) }}
                    </span>
                  </div>
                </div>
                <div class="item-actions">
                  <button 
                    @click.stop="copyFileUrl(file)"
                    class="action-btn"
                    title="Copy URL"
                  >
                    <i class="pi pi-copy"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Empty State -->
          <div v-if="sortedFolders.length === 0 && sortedFiles.length === 0" class="empty-content">
            <i class="pi pi-folder-open empty-icon"></i>
            <h3>Empty Folder</h3>
            <p>This folder doesn't contain any files or subfolders.</p>
            <button @click="showUploadDialog" class="upload-btn">
              <i class="pi pi-plus"></i>
              Add Files
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show"
      ref="contextMenu"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <button @click="createSubfolder" class="menu-item">
        <i class="pi pi-plus"></i>
        Create Subfolder
      </button>
      <button @click="renameFolder" class="menu-item">
        <i class="pi pi-pencil"></i>
        Rename
      </button>
      <button @click="moveFolder" class="menu-item">
        <i class="pi pi-arrows-alt"></i>
        Move
      </button>
      <div class="menu-separator"></div>
      <button @click="deleteFolder" class="menu-item danger">
        <i class="pi pi-trash"></i>
        Delete
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue';
import FolderTreeView from './FolderTreeView.vue';
import FolderThumbnailGrid from './FolderThumbnailGrid.vue';

const props = defineProps({
  initialPath: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['navigate', 'file-selected', 'upload-request', 'folder-action']);

const authHeader = inject('authHeader');

// Navigation state
const currentPath = ref(props.initialPath);
const navigationHistory = ref([]);
const historyIndex = ref(-1);
const isLoading = ref(false);
const error = ref(null);

// View state
const showTreeView = ref(true);
const showPathInput = ref(false);
const pathInputValue = ref('');
const viewMode = ref('grid');
const sortBy = ref('name');
const sortOrder = ref('asc');

// Data state
const folders = ref([]);
const files = ref([]);
const folderTree = ref([]);
const isLoadingTree = ref(false);
const expandedFolders = ref(new Set(['']));

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  folder: null
});

// Computed properties
const pathSegments = computed(() => {
  if (!currentPath.value) return [];
  return currentPath.value.split('/').filter(Boolean);
});

const canGoBack = computed(() => historyIndex.value > 0);
const canGoForward = computed(() => historyIndex.value < navigationHistory.value.length - 1);

const folderCount = computed(() => folders.value.length);
const fileCount = computed(() => files.value.length);
const totalSize = computed(() => files.value.reduce((sum, file) => sum + (file.size || 0), 0));

const sortedFolders = computed(() => {
  return [...folders.value].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(a.lastModified || 0) - new Date(b.lastModified || 0);
        break;
      case 'size':
        comparison = (a.totalSize || 0) - (b.totalSize || 0);
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }
    
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

const sortedFiles = computed(() => {
  return [...files.value].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(a.lastModified || 0) - new Date(b.lastModified || 0);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'type':
        const extA = a.name.split('.').pop() || '';
        const extB = b.name.split('.').pop() || '';
        comparison = extA.localeCompare(extB);
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }
    
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

// Lifecycle
onMounted(() => {
  loadFolderContents(currentPath.value);
  if (showTreeView.value) {
    loadFolderTree();
  }
  
  // Global click handler for context menu
  document.addEventListener('click', hideContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu);
});

// Watch for path changes
watch(currentPath, (newPath) => {
  loadFolderContents(newPath);
  emit('navigate', newPath);
});

// Navigation methods
const navigateToPath = (path) => {
  if (path === currentPath.value) return;
  
  // Add to history
  if (historyIndex.value < navigationHistory.value.length - 1) {
    navigationHistory.value = navigationHistory.value.slice(0, historyIndex.value + 1);
  }
  navigationHistory.value.push(currentPath.value);
  historyIndex.value = navigationHistory.value.length - 1;
  
  currentPath.value = path;
};

const navigateToSegment = (segmentIndex) => {
  const newPath = pathSegments.value.slice(0, segmentIndex + 1).join('/');
  navigateToPath(newPath);
};

const goBack = () => {
  if (canGoBack.value) {
    historyIndex.value--;
    currentPath.value = navigationHistory.value[historyIndex.value];
  }
};

const goForward = () => {
  if (canGoForward.value) {
    historyIndex.value++;
    currentPath.value = navigationHistory.value[historyIndex.value];
  }
};

const navigateToInputPath = () => {
  const trimmedPath = pathInputValue.value.trim();
  navigateToPath(trimmedPath);
  hidePathInput();
};

const hidePathInput = () => {
  showPathInput.value = false;
  pathInputValue.value = '';
};

// Data loading methods
const loadFolderContents = async (path) => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const params = new URLSearchParams({
      path: path || '',
      include_files: 'true',
      include_previews: 'true',
      preview_count: '4',
      depth: '1'
    });
    
    const response = await fetch(`/api/folders?${params}`, {
      headers: {
        'Authorization': authHeader.value
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      folders.value = result.data.folders || [];
      files.value = result.data.files || [];
    } else {
      throw new Error(result.error || 'Failed to load folder contents');
    }
  } catch (err) {
    error.value = err.message;
    folders.value = [];
    files.value = [];
  } finally {
    isLoading.value = false;
  }
};

const loadFolderTree = async () => {
  isLoadingTree.value = true;
  
  try {
    const response = await fetch('/api/folders?depth=3', {
      headers: {
        'Authorization': authHeader.value
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      folderTree.value = buildNestedTree(result.data.folders || []);
    }
  } catch (err) {
    console.error('Failed to load folder tree:', err);
  } finally {
    isLoadingTree.value = false;
  }
};

const refreshCurrentFolder = () => {
  loadFolderContents(currentPath.value);
  if (showTreeView.value) {
    loadFolderTree();
  }
};

// View control methods
const toggleTreeView = () => {
  showTreeView.value = !showTreeView.value;
  if (showTreeView.value && folderTree.value.length === 0) {
    loadFolderTree();
  }
};

const setViewMode = (mode) => {
  viewMode.value = mode;
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};

// File operations
const selectFile = (file) => {
  emit('file-selected', file);
};

const copyFileUrl = async (file) => {
  try {
    await navigator.clipboard.writeText(file.url);
    // Could show toast notification
    console.log('URL copied to clipboard');
  } catch (err) {
    console.error('Failed to copy URL:', err);
  }
};

const isImageFile = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

const handleImageError = (event) => {
  event.target.style.display = 'none';
};

// Context menu methods
const showFolderMenu = (folder, event) => {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    folder
  };
};

const hideContextMenu = () => {
  contextMenu.value.show = false;
};

const createSubfolder = () => {
  emit('folder-action', { action: 'create', folder: contextMenu.value.folder });
  hideContextMenu();
};

const renameFolder = () => {
  emit('folder-action', { action: 'rename', folder: contextMenu.value.folder });
  hideContextMenu();
};

const moveFolder = () => {
  emit('folder-action', { action: 'move', folder: contextMenu.value.folder });
  hideContextMenu();
};

const deleteFolder = () => {
  emit('folder-action', { action: 'delete', folder: contextMenu.value.folder });
  hideContextMenu();
};

const showUploadDialog = () => {
  emit('upload-request', currentPath.value);
};

// Tree view methods
const toggleFolderExpansion = (folderPath) => {
  if (expandedFolders.value.has(folderPath)) {
    expandedFolders.value.delete(folderPath);
  } else {
    expandedFolders.value.add(folderPath);
  }
};

const expandAll = () => {
  const addAllPaths = (folders, basePath = '') => {
    folders.forEach(folder => {
      const fullPath = basePath ? `${basePath}/${folder.name}` : folder.name;
      expandedFolders.value.add(fullPath);
      if (folder.children) {
        addAllPaths(folder.children, fullPath);
      }
    });
  };
  
  expandedFolders.value.add('');
  addAllPaths(folderTree.value);
};

const collapseAll = () => {
  expandedFolders.value.clear();
  expandedFolders.value.add('');
};

// Utility methods
const buildNestedTree = (flatFolders) => {
  // Convert flat folder list to nested tree structure
  const tree = [];
  const lookup = new Map();
  
  // Sort by path depth to ensure parents are processed before children
  const sortedFolders = flatFolders.sort((a, b) => {
    const depthA = (a.path.match(/\//g) || []).length;
    const depthB = (b.path.match(/\//g) || []).length;
    return depthA - depthB;
  });
  
  sortedFolders.forEach(folder => {
    const pathParts = folder.path.split('/');
    const parentPath = pathParts.slice(0, -1).join('/');
    
    const folderNode = {
      ...folder,
      children: []
    };
    
    lookup.set(folder.path, folderNode);
    
    if (!parentPath) {
      tree.push(folderNode);
    } else {
      const parent = lookup.get(parentPath);
      if (parent) {
        parent.children.push(folderNode);
      }
    }
  });
  
  return tree;
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
.folder-navigator {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.navigator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.breadcrumb-nav {
  flex: 1;
  min-width: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.breadcrumb-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
  transition: all 0.2s;
  max-width: 150px;
}

.breadcrumb-btn:hover {
  background: #e9ecef;
  color: #333;
}

.breadcrumb-btn.active {
  background: #007bff;
  color: white;
}

.breadcrumb-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb-separator {
  color: #adb5bd;
  font-size: 0.75rem;
}

.nav-controls {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.nav-btn {
  background: none;
  border: 1px solid #ddd;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #e9ecef;
  color: #333;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.path-input-container {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.path-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
}

.path-icon {
  color: #6c757d;
  flex-shrink: 0;
}

.path-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
}

.go-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  flex-shrink: 0;
}

.navigator-content {
  flex: 1;
  display: flex;
  min-height: 0;
}

.tree-sidebar {
  width: 250px;
  border-right: 1px solid #e9ecef;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.tree-header h3 {
  margin: 0;
  flex: 1;
  font-size: 0.875rem;
}

.expand-all-btn,
.collapse-all-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: #6c757d;
  border-radius: 2px;
}

.expand-all-btn:hover,
.collapse-all-btn:hover {
  background: #e9ecef;
  color: #333;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.tree-loading,
.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #6c757d;
  gap: 0.5rem;
}

.folder-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.folder-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.folder-stats {
  display: flex;
  gap: 1rem;
  color: #6c757d;
  font-size: 0.875rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.view-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-mode-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.view-btn {
  background: white;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #6c757d;
  border-right: 1px solid #ddd;
}

.view-btn:last-child {
  border-right: none;
}

.view-btn:hover {
  background: #e9ecef;
}

.view-btn.active {
  background: #007bff;
  color: white;
}

.sort-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.sort-order-btn {
  background: none;
  border: 1px solid #ddd;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  color: #6c757d;
}

.sort-order-btn:hover {
  background: #e9ecef;
  color: #333;
}

.loading-content,
.error-content,
.empty-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: #6c757d;
  gap: 1rem;
}

.error-content {
  color: #dc3545;
}

.retry-btn,
.upload-btn {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retry-btn:hover,
.upload-btn:hover {
  background: #0056b3;
}

.content-listing {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 500;
}

.folders-grid,
.files-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.folders-grid.view-grid,
.files-grid.view-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.folders-grid.view-list,
.files-grid.view-list {
  grid-template-columns: 1fr;
}

.folder-item,
.file-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  gap: 1rem;
}

.folder-item:hover,
.file-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0,123,255,0.1);
  transform: translateY(-2px);
}

.view-grid .folder-item,
.view-grid .file-item {
  flex-direction: column;
  text-align: center;
}

.view-list .folder-item,
.view-list .file-item {
  flex-direction: row;
}

.item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-grid .item-icon {
  margin-bottom: 0.5rem;
}

.view-list .item-icon {
  margin-right: 0.75rem;
}

.folder-icon,
.file-icon {
  font-size: 2rem;
  color: #007bff;
}

.view-list .folder-icon,
.view-list .file-icon {
  font-size: 1.5rem;
}

.file-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.view-grid .file-thumbnail {
  width: 100px;
  height: 100px;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.view-grid .item-info {
  text-align: center;
}

.item-name {
  font-weight: 500;
  color: #333;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  white-space: normal;
  line-height: 1.3;
}

.view-grid .item-name {
  max-height: 3.9em;
  overflow: hidden;
}

.view-list .item-name {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.item-meta {
  font-size: 0.75rem;
  color: #6c757d;
  display: flex;
  gap: 0.5rem;
}

.view-grid .item-meta {
  justify-content: center;
}

.item-actions {
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #6c757d;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.folder-item:hover .action-btn,
.file-item:hover .action-btn {
  opacity: 1;
}

.action-btn:hover {
  background: #e9ecef;
  color: #333;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  min-width: 150px;
  overflow: hidden;
}

.menu-item {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
  font-size: 0.875rem;
}

.menu-item:hover {
  background: #f8f9fa;
}

.menu-item.danger {
  color: #dc3545;
}

.menu-item.danger:hover {
  background: #f8d7da;
}

.menu-separator {
  height: 1px;
  background: #e9ecef;
  margin: 0.25rem 0;
}

/* Responsive */
@media (max-width: 768px) {
  .tree-sidebar {
    display: none;
  }
  
  .navigator-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .folder-info {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .folders-grid,
  .files-grid {
    grid-template-columns: 1fr;
  }
  
  .breadcrumb {
    flex-wrap: wrap;
  }
  
  .breadcrumb-btn {
    max-width: 120px;
  }
}
</style>