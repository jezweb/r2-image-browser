<template>
  <div class="folder-tree-view">
    <div 
      v-for="folder in folders" 
      :key="folder.path || folder.name"
      class="tree-item"
    >
      <!-- Folder Item -->
      <div 
        :class="['folder-item', { 
          active: isCurrentPath(folder.path), 
          expanded: isExpanded(folder.path) 
        }]"
        @click="navigateToFolder(folder.path)"
      >
        <!-- Expand/Collapse Button -->
        <button
          v-if="folder.children && folder.children.length > 0"
          @click.stop="toggleExpansion(folder.path)"
          class="expand-btn"
          :aria-label="isExpanded(folder.path) ? 'Collapse folder' : 'Expand folder'"
        >
          <i :class="isExpanded(folder.path) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
        </button>
        <div v-else class="expand-spacer"></div>
        
        <!-- Folder Icon and Name -->
        <div class="folder-content">
          <i :class="getFolderIcon(folder)" class="folder-icon"></i>
          <span class="folder-name" :title="folder.name">{{ folder.name }}</span>
          <span v-if="folder.fileCount !== undefined" class="file-count">
            {{ folder.fileCount }}
          </span>
        </div>
      </div>
      
      <!-- Child Folders (Recursive) -->
      <div 
        v-if="isExpanded(folder.path) && folder.children && folder.children.length > 0" 
        class="children"
      >
        <FolderTreeView
          :folders="folder.children"
          :current-path="currentPath"
          :expanded-folders="expandedFolders"
          @navigate="$emit('navigate', $event)"
          @toggle-expand="$emit('toggle-expand', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  folders: {
    type: Array,
    default: () => []
  },
  currentPath: {
    type: String,
    default: ''
  },
  expandedFolders: {
    type: Set,
    default: () => new Set()
  }
});

const emit = defineEmits(['navigate', 'toggle-expand']);

// Computed properties
const isCurrentPath = (folderPath) => {
  return folderPath === props.currentPath;
};

const isExpanded = (folderPath) => {
  return props.expandedFolders.has(folderPath || '');
};

// Methods
const navigateToFolder = (folderPath) => {
  emit('navigate', folderPath || '');
};

const toggleExpansion = (folderPath) => {
  emit('toggle-expand', folderPath || '');
};

const getFolderIcon = (folder) => {
  // Show different icons based on folder state
  if (isCurrentPath(folder.path)) {
    return 'pi pi-folder-open';
  }
  
  if (folder.children && folder.children.length > 0) {
    return isExpanded(folder.path) ? 'pi pi-folder-open' : 'pi pi-folder';
  }
  
  return 'pi pi-folder';
};
</script>

<style scoped>
.folder-tree-view {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.tree-item {
  position: relative;
}

.folder-item {
  display: flex;
  align-items: center;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  user-select: none;
  position: relative;
}

.folder-item:hover {
  background-color: #f8f9fa;
}

.folder-item.active {
  background-color: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}

.folder-item.active .folder-icon {
  color: #1976d2;
}

.expand-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: #666;
  font-size: 0.75rem;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.expand-btn:hover {
  background-color: #e9ecef;
  color: #333;
}

.expand-spacer {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.folder-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.folder-icon {
  color: #007bff;
  font-size: 1rem;
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.folder-name {
  color: #333;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.file-count {
  font-size: 0.75rem;
  color: #6c757d;
  background: #e9ecef;
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  flex-shrink: 0;
  min-width: fit-content;
}

.children {
  margin-left: 1rem;
  border-left: 1px solid #e9ecef;
  position: relative;
}

.children::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(to bottom, #e9ecef 0%, transparent 100%);
}

/* Hover effects for better UX */
.tree-item:hover > .folder-item {
  background-color: #f8f9fa;
}

.tree-item:hover > .folder-item .folder-icon {
  color: #0056b3;
}

/* Active state styling */
.folder-item.active .folder-name {
  color: #1976d2;
}

.folder-item.active .file-count {
  background: #bbdefb;
  color: #0d47a1;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .folder-item {
    padding: 0.5rem 0.375rem;
  }
  
  .folder-name {
    font-size: 0.8125rem;
  }
  
  .file-count {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.25rem;
  }
  
  .children {
    margin-left: 0.75rem;
  }
}

/* Focus styles for accessibility */
.expand-btn:focus,
.folder-item:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

/* Animation for expand/collapse */
.children {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

/* Loading state (if needed) */
.folder-item.loading {
  opacity: 0.6;
}

.folder-item.loading .folder-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>