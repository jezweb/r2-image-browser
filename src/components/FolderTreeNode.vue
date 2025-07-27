<template>
  <div class="tree-node">
    <div 
      :class="['node-item', { 'expanded': isExpanded }]"
      :style="{ paddingLeft: (level * 20) + 'px' }"
    >
      <!-- Folder Toggle and Icon -->
      <button 
        v-if="node.children && node.children.length > 0"
        @click="toggleExpand"
        class="expand-btn"
      >
        <i :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
      </button>
      <div v-else class="expand-spacer"></div>
      
      <!-- Folder Icon and Name -->
      <div class="node-content">
        <i :class="getNodeIcon()" class="node-icon"></i>
        <span class="node-name">{{ getDisplayName() }}</span>
        <span class="node-count">({{ getTotalCount() }})</span>
      </div>
    </div>
    
    <!-- Child Folders -->
    <div v-if="isExpanded && node.children" class="children">
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.name"
        :node="child"
        :level="level + 1"
        @remove-file="$emit('remove-file', $event)"
      />
    </div>
    
    <!-- Files in this folder -->
    <div v-if="isExpanded && node.files && node.files.length > 0" class="files">
      <div 
        v-for="file in node.files" 
        :key="file.relativePath"
        class="file-item"
        :style="{ paddingLeft: ((level + 1) * 20) + 'px' }"
      >
        <div class="file-spacer"></div>
        <i class="pi pi-file file-icon"></i>
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">{{ formatFileSize(file.size) }}</span>
        <button @click="removeFile(file)" class="remove-file-btn">
          <i class="pi pi-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  level: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['remove-file']);

const isExpanded = ref(true); // Default to expanded for better UX

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const getNodeIcon = () => {
  if (props.node.type === 'folder') {
    return isExpanded.value ? 'pi pi-folder-open' : 'pi pi-folder';
  }
  return 'pi pi-file';
};

const getDisplayName = () => {
  if (props.node.name === '/') {
    return 'Root';
  }
  return props.node.name || 'Unnamed';
};

const getTotalCount = () => {
  let count = 0;
  
  // Count files in this folder
  if (props.node.files) {
    count += props.node.files.length;
  }
  
  // Count files in child folders recursively
  const countInChildren = (children) => {
    if (!children) return 0;
    
    let childCount = 0;
    children.forEach(child => {
      if (child.files) {
        childCount += child.files.length;
      }
      if (child.children) {
        childCount += countInChildren(child.children);
      }
    });
    return childCount;
  };
  
  if (props.node.children) {
    count += countInChildren(props.node.children);
  }
  
  return count;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const removeFile = (file) => {
  emit('remove-file', file);
};
</script>

<style scoped>
.tree-node {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.node-item {
  display: flex;
  align-items: center;
  padding: 0.375rem 0;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.node-item:hover {
  background-color: #f8f9fa;
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
}

.expand-btn:hover {
  background-color: #e9ecef;
  color: #333;
}

.expand-spacer {
  width: 20px;
  height: 20px;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.node-icon {
  color: #007bff;
  font-size: 1rem;
  flex-shrink: 0;
}

.node-name {
  font-weight: 500;
  color: #333;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.node-count {
  font-size: 0.875rem;
  color: #666;
  margin-left: auto;
  flex-shrink: 0;
}

.children {
  border-left: 1px solid #e9ecef;
  margin-left: 10px;
}

.files {
  border-left: 1px solid #e9ecef;
  margin-left: 10px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.875rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f8f9fa;
}

.file-spacer {
  width: 20px;
  height: 16px;
}

.file-icon {
  color: #6c757d;
  font-size: 0.875rem;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.file-name {
  color: #495057;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.file-size {
  font-size: 0.75rem;
  color: #6c757d;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.remove-file-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 0.25rem;
  margin-left: 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.file-item:hover .remove-file-btn {
  opacity: 1;
}

.remove-file-btn:hover {
  background-color: rgba(220, 53, 69, 0.1);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .node-item {
    padding: 0.5rem 0;
  }
  
  .file-item {
    padding: 0.375rem 0;
  }
  
  .node-name,
  .file-name {
    font-size: 0.875rem;
  }
  
  .node-count,
  .file-size {
    font-size: 0.75rem;
  }
}
</style>