<template>
  <div class="folder-tree-upload">
    <!-- Upload Method Selection -->
    <div class="upload-method-selector">
      <div class="method-tabs">
        <button 
          :class="['method-tab', { active: activeMethod === 'drag-drop' }]"
          @click="setActiveMethod('drag-drop')"
          :disabled="!capabilities.advancedDragDrop"
        >
          <i class="pi pi-upload"></i>
          Drag & Drop
        </button>
        <button 
          :class="['method-tab', { active: activeMethod === 'folder-select' }]"
          @click="setActiveMethod('folder-select')"
          :disabled="!capabilities.directoryInput"
        >
          <i class="pi pi-folder"></i>
          Select Folder
        </button>
        <button 
          :class="['method-tab', { active: activeMethod === 'file-select' }]"
          @click="setActiveMethod('file-select')"
        >
          <i class="pi pi-file"></i>
          Select Files
        </button>
      </div>
      
      <div class="method-info">
        <span class="method-description">{{ getMethodDescription() }}</span>
      </div>
    </div>

    <!-- Active Upload Interface -->
    <div class="upload-interface">
      <!-- Drag & Drop Interface -->
      <FolderDropZone
        v-if="activeMethod === 'drag-drop'"
        @uploaded="handleUploadComplete"
        @folder-detected="handleFolderDetected"
      />
      
      <!-- Folder Selection Interface -->
      <div v-else-if="activeMethod === 'folder-select'" class="folder-select-interface">
        <div class="select-controls">
          <button @click="selectFolder" class="select-folder-btn">
            <i class="pi pi-folder-open"></i>
            Choose Folder
          </button>
          <input 
            ref="folderInput"
            type="file" 
            webkitdirectory
            multiple 
            style="display: none"
            @change="handleFolderSelection"
          >
        </div>
        
        <!-- Selected Folder Preview -->
        <div v-if="selectedFolderStructure.files.length > 0" class="folder-preview">
          <div class="preview-header">
            <h3>
              <i class="pi pi-folder"></i>
              Selected Folder: {{ selectedFolderName }}
            </h3>
            <span class="file-count">{{ selectedFolderStructure.files.length }} files</span>
          </div>
          
          <div class="folder-tree-container">
            <FolderTreeNode
              v-for="folder in selectedFolderTree"
              :key="folder.name"
              :node="folder"
              :level="0"
              @remove-file="removeFile"
            />
          </div>
          
          <div class="upload-actions">
            <button @click="clearSelection" class="clear-btn">
              <i class="pi pi-times"></i>
              Clear Selection
            </button>
            <button @click="uploadSelectedFolder" class="upload-btn" :disabled="isUploading">
              <i :class="isUploading ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'"></i>
              {{ isUploading ? 'Uploading...' : 'Upload Folder' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- File Selection Interface -->
      <div v-else-if="activeMethod === 'file-select'" class="file-select-interface">
        <div class="select-controls">
          <button @click="selectFiles" class="select-files-btn">
            <i class="pi pi-file"></i>
            Choose Files
          </button>
          <input 
            ref="fileInput"
            type="file" 
            multiple
            accept="image/*"
            style="display: none"
            @change="handleFileSelection"
          >
        </div>
        
        <!-- File Organization Interface -->
        <div v-if="selectedFiles.length > 0" class="file-organization">
          <div class="organization-header">
            <h3>
              <i class="pi pi-images"></i>
              Organize {{ selectedFiles.length }} Files
            </h3>
          </div>
          
          <div class="organization-tools">
            <div class="tool-group">
              <label>Create folders by:</label>
              <div class="organization-options">
                <button 
                  @click="organizeByPrefix" 
                  class="organize-btn"
                  title="Group files by common prefix (e.g., 'icon-', 'bg-')"
                >
                  <i class="pi pi-sort-alpha-down"></i>
                  Prefix
                </button>
                <button 
                  @click="organizeByType" 
                  class="organize-btn"
                  title="Group files by file type"
                >
                  <i class="pi pi-file"></i>
                  Type
                </button>
                <button 
                  @click="createCustomFolder" 
                  class="organize-btn"
                  title="Create custom folder structure"
                >
                  <i class="pi pi-plus"></i>
                  Custom
                </button>
              </div>
            </div>
          </div>
          
          <div class="file-list">
            <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
              <img v-if="file.preview" :src="file.preview" alt="Preview" class="file-preview">
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <input 
                  v-model="file.targetPath" 
                  type="text" 
                  class="path-input"
                  placeholder="folder/subfolder/filename.ext"
                >
              </div>
              <button @click="removeFile(index)" class="remove-file-btn">
                <i class="pi pi-times"></i>
              </button>
            </div>
          </div>
          
          <div class="upload-actions">
            <button @click="clearFileSelection" class="clear-btn">
              <i class="pi pi-times"></i>
              Clear All
            </button>
            <button @click="uploadOrganizedFiles" class="upload-btn" :disabled="isUploading">
              <i :class="isUploading ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'"></i>
              {{ isUploading ? 'Uploading...' : 'Upload Files' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Progress -->
    <UploadProgressTree 
      v-if="uploadProgress.length > 0"
      :progress="uploadProgress"
      @copy-url="copyUrl"
    />

    <!-- Custom Folder Modal -->
    <div v-if="showCustomFolderModal" class="modal-overlay" @click="closeCustomFolderModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Create Custom Folder Structure</h3>
          <button @click="closeCustomFolderModal" class="close-btn">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="folder-input-group">
            <label>Folder name:</label>
            <input 
              v-model="customFolderName" 
              type="text" 
              placeholder="e.g., icons/social"
              class="folder-name-input"
              @keyup.enter="createCustomFolderStructure"
            >
          </div>
          <div class="selected-files-info">
            <span>{{ selectedFilesForCustomFolder.length }} files will be moved to this folder</span>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeCustomFolderModal" class="cancel-btn">Cancel</button>
          <button @click="createCustomFolderStructure" class="confirm-btn">Create Folder</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import FolderDropZone from './FolderDropZone.vue';
import FolderTreeNode from './FolderTreeNode.vue';
import UploadProgressTree from './UploadProgressTree.vue';

const emit = defineEmits(['uploaded']);
const authHeader = inject('authHeader');

// Component state
const activeMethod = ref('drag-drop');
const capabilities = ref({
  advancedDragDrop: false,
  directoryInput: false,
  touchDevice: false
});

// Folder selection state
const selectedFolderStructure = ref({ files: [], folders: new Set() });
const selectedFolderName = ref('');

// File selection state
const selectedFiles = ref([]);
const showCustomFolderModal = ref(false);
const customFolderName = ref('');
const selectedFilesForCustomFolder = ref([]);

// Upload state
const isUploading = ref(false);
const uploadProgress = ref([]);

// Lifecycle
onMounted(() => {
  detectCapabilities();
});

// Capability detection
const detectCapabilities = () => {
  capabilities.value = {
    advancedDragDrop: 'webkitGetAsEntry' in DataTransferItem.prototype && 'items' in DataTransfer.prototype,
    directoryInput: 'webkitdirectory' in document.createElement('input'),
    touchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  };
  
  // Auto-select best available method
  if (capabilities.value.advancedDragDrop && !capabilities.value.touchDevice) {
    activeMethod.value = 'drag-drop';
  } else if (capabilities.value.directoryInput) {
    activeMethod.value = 'folder-select';
  } else {
    activeMethod.value = 'file-select';
  }
};

// Computed properties
const selectedFolderTree = computed(() => {
  return buildFolderTree(selectedFolderStructure.value.files);
});

const getMethodDescription = () => {
  const descriptions = {
    'drag-drop': 'Drag entire folders from your desktop to preserve structure automatically',
    'folder-select': 'Select a folder using your browser\'s folder picker dialog',
    'file-select': 'Select multiple files and organize them manually into folders'
  };
  return descriptions[activeMethod.value] || '';
};

// Method switching
const setActiveMethod = (method) => {
  if (method === 'drag-drop' && !capabilities.value.advancedDragDrop) return;
  if (method === 'folder-select' && !capabilities.value.directoryInput) return;
  
  activeMethod.value = method;
  clearAll();
};

// Folder selection methods
const selectFolder = () => {
  document.querySelector('input[webkitdirectory]').click();
};

const handleFolderSelection = (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  // Extract folder name from first file's path
  const firstFile = files[0];
  if (firstFile.webkitRelativePath) {
    selectedFolderName.value = firstFile.webkitRelativePath.split('/')[0];
  }
  
  processFiles(files, true);
};

// File selection methods
const selectFiles = () => {
  document.querySelector('input[type="file"][multiple]').click();
};

const handleFileSelection = (e) => {
  const files = Array.from(e.target.files);
  selectedFiles.value = [];
  
  files.forEach(file => {
    if (validateFile(file)) {
      const fileObj = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        targetPath: file.name, // Default to filename
        preview: null
      };
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          fileObj.preview = e.target.result;
        };
        reader.readAsDataURL(file);
      }
      
      selectedFiles.value.push(fileObj);
    }
  });
};

// File processing methods
const processFiles = (files, isFromFolder = false) => {
  const processedFiles = [];
  
  files.forEach(file => {
    if (validateFile(file)) {
      const relativePath = isFromFolder ? file.webkitRelativePath : file.name;
      processedFiles.push({
        file,
        relativePath,
        name: file.name,
        size: file.size,
        type: file.type
      });
    }
  });
  
  if (isFromFolder) {
    updateSelectedStructure(processedFiles);
  }
};

const validateFile = (file) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  return allowedTypes.includes(file.type) && file.size <= maxSize;
};

const updateSelectedStructure = (files) => {
  const folders = new Set();
  
  files.forEach(fileObj => {
    const pathParts = fileObj.relativePath.split('/');
    if (pathParts.length > 1) {
      for (let i = 1; i < pathParts.length; i++) {
        const folderPath = pathParts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }
  });
  
  selectedFolderStructure.value = { files, folders };
};

const buildFolderTree = (files) => {
  // Same implementation as in FolderDropZone
  const tree = new Map();
  
  files.forEach(fileObj => {
    const pathParts = fileObj.relativePath.split('/');
    
    if (pathParts.length === 1) {
      if (!tree.has('_root')) {
        tree.set('_root', { name: 'Root', type: 'folder', children: [], files: [] });
      }
      tree.get('_root').files.push(fileObj);
    } else {
      let currentLevel = tree;
      let currentPath = '';
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        currentPath += (i > 0 ? '/' : '') + folderName;
        
        if (!currentLevel.has(folderName)) {
          currentLevel.set(folderName, {
            name: folderName,
            path: currentPath,
            type: 'folder',
            children: new Map(),
            files: []
          });
        }
        
        currentLevel = currentLevel.get(folderName).children;
      }
      
      const deepestFolder = pathParts[pathParts.length - 2];
      if (currentLevel.has(deepestFolder)) {
        currentLevel.get(deepestFolder).files.push(fileObj);
      }
    }
  });
  
  const convertMapToArray = (map) => {
    return Array.from(map.values()).map(node => ({
      ...node,
      children: node.children ? convertMapToArray(node.children) : []
    }));
  };
  
  return convertMapToArray(tree);
};

// File organization methods
const organizeByPrefix = () => {
  const groups = new Map();
  
  selectedFiles.value.forEach(file => {
    const match = file.name.match(/^([a-zA-Z]+[-_]?)/);
    const prefix = match ? match[1].replace(/[-_]$/, '') : 'misc';
    
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix).push(file);
  });
  
  groups.forEach((files, prefix) => {
    files.forEach(file => {
      file.targetPath = `${prefix}/${file.name}`;
    });
  });
};

const organizeByType = () => {
  selectedFiles.value.forEach(file => {
    const extension = file.name.split('.').pop().toLowerCase();
    const typeFolder = {
      'png': 'images/png',
      'jpg': 'images/jpg',
      'jpeg': 'images/jpg',
      'gif': 'images/gif',
      'svg': 'vectors/svg',
      'webp': 'images/webp'
    }[extension] || 'misc';
    
    file.targetPath = `${typeFolder}/${file.name}`;
  });
};

const createCustomFolder = () => {
  selectedFilesForCustomFolder.value = [...selectedFiles.value];
  showCustomFolderModal.value = true;
};

const createCustomFolderStructure = () => {
  if (!customFolderName.value.trim()) return;
  
  selectedFiles.value.forEach(file => {
    file.targetPath = `${customFolderName.value.trim()}/${file.name}`;
  });
  
  closeCustomFolderModal();
};

const closeCustomFolderModal = () => {
  showCustomFolderModal.value = false;
  customFolderName.value = '';
  selectedFilesForCustomFolder.value = [];
};

// Upload methods
const uploadSelectedFolder = async () => {
  await performUpload(selectedFolderStructure.value.files, true);
};

const uploadOrganizedFiles = async () => {
  const files = selectedFiles.value.map(fileObj => ({
    file: fileObj.file,
    relativePath: fileObj.targetPath,
    name: fileObj.name,
    size: fileObj.size,
    type: fileObj.type
  }));
  
  await performUpload(files, false);
};

const performUpload = async (files, preserveStructure) => {
  if (isUploading.value || files.length === 0) return;
  
  isUploading.value = true;
  uploadProgress.value = [];
  
  try {
    const formData = new FormData();
    
    files.forEach(fileObj => {
      formData.append('files', fileObj.file);
    });
    
    const folderStructure = {};
    files.forEach(fileObj => {
      folderStructure[fileObj.file.name] = fileObj.relativePath;
    });
    formData.append('folderStructure', JSON.stringify(folderStructure));
    formData.append('conflictResolution', 'rename');
    
    const response = await fetch('/api/admin/upload/batch', {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      uploadProgress.value = result.data.results.map(res => ({
        ...res,
        id: res.originalName + '_' + Date.now()
      }));
      
      clearAll();
      emit('uploaded', result.data);
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (error) {
    uploadProgress.value = [{
      id: 'error_' + Date.now(),
      originalName: 'Upload Error',
      status: 'failed',
      error: error.message
    }];
  } finally {
    isUploading.value = false;
  }
};

// Event handlers
const handleUploadComplete = (result) => {
  emit('uploaded', result);
};

const handleFolderDetected = (folderName) => {
  console.log('Folder detected:', folderName);
};

const removeFile = (fileToRemove) => {
  if (typeof fileToRemove === 'number') {
    // Remove from selectedFiles by index
    selectedFiles.value.splice(fileToRemove, 1);
  } else {
    // Remove from folder structure by file object
    selectedFolderStructure.value.files = selectedFolderStructure.value.files.filter(
      f => f.relativePath !== fileToRemove.relativePath
    );
    updateSelectedStructure(selectedFolderStructure.value.files);
  }
};

const copyUrl = (url) => {
  navigator.clipboard.writeText(url);
};

// Cleanup methods
const clearSelection = () => {
  selectedFolderStructure.value = { files: [], folders: new Set() };
  selectedFolderName.value = '';
};

const clearFileSelection = () => {
  selectedFiles.value = [];
};

const clearAll = () => {
  clearSelection();
  clearFileSelection();
  uploadProgress.value = [];
};
</script>

<style scoped>
.folder-tree-upload {
  padding: 1rem;
}

.upload-method-selector {
  margin-bottom: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.method-tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
}

.method-tab {
  flex: 1;
  padding: 1rem;
  background: #f8f9fa;
  border: none;
  border-right: 1px solid #ddd;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.method-tab:last-child {
  border-right: none;
}

.method-tab:hover:not(:disabled) {
  background: #e9ecef;
}

.method-tab.active {
  background: #007bff;
  color: white;
}

.method-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f8f9fa;
}

.method-info {
  padding: 1rem;
  text-align: center;
  color: #6c757d;
  font-size: 0.875rem;
}

.upload-interface {
  min-height: 300px;
}

.folder-select-interface,
.file-select-interface {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.select-controls {
  padding: 2rem;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.select-folder-btn,
.select-files-btn {
  padding: 1rem 2rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.select-folder-btn:hover,
.select-files-btn:hover {
  background: #0056b3;
}

.folder-preview,
.file-organization {
  padding: 1rem;
}

.preview-header,
.organization-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.preview-header h3,
.organization-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-count {
  color: #6c757d;
  font-size: 0.875rem;
}

.folder-tree-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.organization-tools {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-group label {
  font-weight: 500;
  color: #333;
}

.organization-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.organize-btn {
  padding: 0.5rem 1rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.organize-btn:hover {
  background: #545b62;
}

.file-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  gap: 1rem;
}

.file-item:last-child {
  border-bottom: none;
}

.file-preview {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-name {
  font-weight: 500;
  color: #333;
}

.path-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 100%;
}

.remove-file-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.remove-file-btn:hover {
  background: #c82333;
}

.upload-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
}

.clear-btn {
  padding: 0.75rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clear-btn:hover {
  background: #545b62;
}

.upload-btn {
  padding: 0.75rem 2rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-btn:hover:not(:disabled) {
  background: #218838;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: #6c757d;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1rem;
}

.folder-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.folder-input-group label {
  font-weight: 500;
}

.folder-name-input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.selected-files-info {
  color: #6c757d;
  font-size: 0.875rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #eee;
}

.cancel-btn,
.confirm-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background: #545b62;
}

.confirm-btn {
  background: #007bff;
  color: white;
}

.confirm-btn:hover {
  background: #0056b3;
}

/* Responsive */
@media (max-width: 768px) {
  .method-tabs {
    flex-direction: column;
  }
  
  .method-tab {
    border-right: none;
    border-bottom: 1px solid #ddd;
  }
  
  .upload-actions {
    flex-direction: column;
  }
  
  .organization-options {
    justify-content: center;
  }
}
</style>