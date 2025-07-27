<template>
  <div class="folder-drop-zone">
    <!-- Drop Zone -->
    <div 
      :class="['dropzone', { 
        'dragging': isDragging, 
        'folder-detected': folderDetected,
        'has-files': selectedStructure.files.length > 0 
      }]"
      @drop="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @click="showFileSelector"
    >
      <div class="dropzone-content">
        <i :class="getDropZoneIcon()"></i>
        <h3>{{ getDropZoneTitle() }}</h3>
        <p>{{ getDropZoneMessage() }}</p>
        <p class="file-types">Supported: PNG, JPG, GIF, SVG, WebP (Max 10MB per file)</p>
        
        <!-- Browser Capability Info -->
        <div v-if="!capabilities.advancedDragDrop" class="capability-info">
          <i class="pi pi-info-circle"></i>
          <span>{{ getCapabilityMessage() }}</span>
        </div>
      </div>
      
      <!-- Hidden File Inputs -->
      <input 
        ref="fileInput"
        type="file" 
        multiple 
        accept="image/*"
        style="display: none"
        @change="handleFileSelect"
      >
      <input 
        v-if="capabilities.directoryInput"
        ref="folderInput"
        type="file" 
        webkitdirectory
        multiple 
        style="display: none"
        @change="handleFolderSelect"
      >
    </div>

    <!-- Folder Structure Preview -->
    <div v-if="selectedStructure.files.length > 0" class="structure-preview">
      <div class="preview-header">
        <h3>
          <i class="pi pi-folder"></i>
          Folder Structure Preview ({{ selectedStructure.files.length }} files)
        </h3>
        <button @click="clearSelection" class="clear-btn">
          <i class="pi pi-times"></i>
          Clear
        </button>
      </div>
      
      <div class="folder-tree">
        <FolderTreeNode 
          v-for="folder in folderTree" 
          :key="folder.name"
          :node="folder"
          :level="0"
          @remove-file="removeFile"
        />
      </div>
      
      <!-- Upload Controls -->
      <div class="upload-controls">
        <div class="control-group">
          <label>Target Folder:</label>
          <input 
            v-model="targetPath" 
            type="text" 
            placeholder="Optional: e.g., assets/new-collection"
            class="path-input"
          >
        </div>
        
        <div class="control-group">
          <label>Conflict Resolution:</label>
          <select v-model="conflictResolution" class="conflict-select">
            <option value="rename">Rename (add -1, -2, etc.)</option>
            <option value="skip">Skip existing files</option>
            <option value="overwrite">Overwrite existing files</option>
          </select>
        </div>
        
        <button 
          @click="startUpload" 
          :disabled="isUploading || selectedStructure.files.length === 0"
          class="upload-btn"
        >
          <i :class="isUploading ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'"></i>
          {{ isUploading ? 'Uploading...' : `Upload ${selectedStructure.files.length} Files` }}
        </button>
      </div>
    </div>

    <!-- Upload Progress -->
    <UploadProgressTree 
      v-if="uploadProgress.length > 0"
      :progress="uploadProgress"
      @copy-url="copyUrl"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import FolderTreeNode from './FolderTreeNode.vue';
import UploadProgressTree from './UploadProgressTree.vue';

const emit = defineEmits(['uploaded', 'folder-detected']);
const authHeader = inject('authHeader');

// Reactive state
const isDragging = ref(false);
const folderDetected = ref(false);
const selectedStructure = ref({ files: [], folders: new Set() });
const targetPath = ref('');
const conflictResolution = ref('rename');
const isUploading = ref(false);
const uploadProgress = ref([]);

// Browser capability detection
const capabilities = ref({
  advancedDragDrop: false,
  directoryInput: false,
  touchDevice: false
});

// Detect browser capabilities on mount
onMounted(() => {
  detectCapabilities();
});

const detectCapabilities = () => {
  capabilities.value = {
    advancedDragDrop: 'webkitGetAsEntry' in DataTransferItem.prototype && 'items' in DataTransfer.prototype,
    directoryInput: 'webkitdirectory' in document.createElement('input'),
    touchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  };
};

// Computed properties
const folderTree = computed(() => {
  return buildFolderTree(selectedStructure.value.files);
});

const getDropZoneIcon = () => {
  if (isUploading.value) return 'pi pi-spin pi-spinner';
  if (folderDetected.value) return 'pi pi-folder-open';
  if (selectedStructure.value.files.length > 0) return 'pi pi-check-circle';
  return 'pi pi-upload';
};

const getDropZoneTitle = () => {
  if (selectedStructure.value.files.length > 0) {
    return `${selectedStructure.value.files.length} files selected`;
  }
  if (capabilities.value.advancedDragDrop) {
    return 'Drag & Drop Folders or Files';
  }
  return 'Select Files or Folders';
};

const getDropZoneMessage = () => {
  if (capabilities.value.advancedDragDrop && !capabilities.value.touchDevice) {
    return 'Drag entire folders from your desktop to preserve structure, or click to browse';
  } else if (capabilities.value.directoryInput) {
    return 'Click to select multiple files or entire folders';
  } else {
    return 'Click to select multiple files (folder structure will need manual organization)';
  }
};

const getCapabilityMessage = () => {
  if (capabilities.value.directoryInput) {
    return 'Folder upload supported via file picker';
  } else {
    return 'Advanced folder upload not supported in this browser';
  }
};

// Event handlers
const handleDragOver = (e) => {
  e.preventDefault();
  isDragging.value = true;
  
  // Detect if folders are being dragged
  if (capabilities.value.advancedDragDrop && e.dataTransfer.items) {
    folderDetected.value = Array.from(e.dataTransfer.items).some(item => 
      item.webkitGetAsEntry && item.webkitGetAsEntry()?.isDirectory
    );
  }
};

const handleDragLeave = (e) => {
  e.preventDefault();
  isDragging.value = false;
  folderDetected.value = false;
};

const handleDrop = async (e) => {
  e.preventDefault();
  isDragging.value = false;
  folderDetected.value = false;
  
  if (capabilities.value.advancedDragDrop && e.dataTransfer.items) {
    await processDataTransferItems(e.dataTransfer.items);
  } else {
    processFileList(Array.from(e.dataTransfer.files));
  }
};

const showFileSelector = () => {
  if (capabilities.value.directoryInput) {
    // Show choice between files and folders
    const choice = confirm('Select folders (OK) or individual files (Cancel)?');
    if (choice) {
      document.querySelector('input[webkitdirectory]').click();
    } else {
      document.querySelector('input[type="file"][multiple]').click();
    }
  } else {
    document.querySelector('input[type="file"][multiple]').click();
  }
};

const handleFileSelect = (e) => {
  processFileList(Array.from(e.target.files));
};

const handleFolderSelect = (e) => {
  processFileList(Array.from(e.target.files));
};

// File processing functions
const processDataTransferItems = async (items) => {
  const files = [];
  
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      if (entry.isDirectory) {
        await processDirectoryEntry(entry, '', files);
        emit('folder-detected', entry.name);
      } else {
        const file = await getFileFromEntry(entry);
        if (file && validateFile(file)) {
          files.push({
            file,
            relativePath: entry.name,
            name: entry.name,
            size: file.size,
            type: file.type
          });
        }
      }
    }
  }
  
  updateSelectedStructure(files);
};

const processDirectoryEntry = async (dirEntry, parentPath, files) => {
  const reader = dirEntry.createReader();
  const currentPath = parentPath + dirEntry.name;
  
  try {
    const entries = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        await processDirectoryEntry(entry, currentPath + '/', files);
      } else {
        const file = await getFileFromEntry(entry);
        if (file && validateFile(file)) {
          const relativePath = currentPath + '/' + entry.name;
          files.push({
            file,
            relativePath,
            name: entry.name,
            size: file.size,
            type: file.type
          });
        }
      }
    }
  } catch (error) {
    console.warn('Error reading directory:', dirEntry.name, error);
  }
};

const getFileFromEntry = (entry) => {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
};

const processFileList = (files) => {
  const processedFiles = [];
  
  for (const file of files) {
    if (validateFile(file)) {
      // Extract relative path from webkitRelativePath if available
      const relativePath = file.webkitRelativePath || file.name;
      processedFiles.push({
        file,
        relativePath,
        name: file.name,
        size: file.size,
        type: file.type
      });
    }
  }
  
  updateSelectedStructure(processedFiles);
};

const validateFile = (file) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    console.warn(`Skipping ${file.name}: Invalid file type`);
    return false;
  }
  
  if (file.size > maxSize) {
    console.warn(`Skipping ${file.name}: File too large`);
    return false;
  }
  
  return true;
};

const updateSelectedStructure = (files) => {
  const folders = new Set();
  
  files.forEach(fileObj => {
    const pathParts = fileObj.relativePath.split('/');
    if (pathParts.length > 1) {
      // Build all parent folder paths
      for (let i = 1; i < pathParts.length; i++) {
        const folderPath = pathParts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }
  });
  
  selectedStructure.value = { files, folders };
};

const buildFolderTree = (files) => {
  const tree = new Map();
  
  files.forEach(fileObj => {
    const pathParts = fileObj.relativePath.split('/');
    
    if (pathParts.length === 1) {
      // Root level file
      if (!tree.has('_root')) {
        tree.set('_root', { name: '/', type: 'folder', children: [], files: [] });
      }
      tree.get('_root').files.push(fileObj);
    } else {
      // Nested file - build folder structure
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
      
      // Add file to the deepest folder
      const deepestFolder = pathParts[pathParts.length - 2];
      if (currentLevel.has(deepestFolder)) {
        currentLevel.get(deepestFolder).files.push(fileObj);
      }
    }
  });
  
  // Convert Maps to Arrays for template rendering
  const convertMapToArray = (map) => {
    return Array.from(map.values()).map(node => ({
      ...node,
      children: node.children ? convertMapToArray(node.children) : []
    }));
  };
  
  return convertMapToArray(tree);
};

const removeFile = (fileToRemove) => {
  selectedStructure.value.files = selectedStructure.value.files.filter(
    f => f.relativePath !== fileToRemove.relativePath
  );
  updateSelectedStructure(selectedStructure.value.files);
};

const clearSelection = () => {
  selectedStructure.value = { files: [], folders: new Set() };
  uploadProgress.value = [];
};

const startUpload = async () => {
  if (isUploading.value || selectedStructure.value.files.length === 0) return;
  
  isUploading.value = true;
  uploadProgress.value = [];
  
  try {
    const formData = new FormData();
    
    // Add all files
    selectedStructure.value.files.forEach(fileObj => {
      formData.append('files', fileObj.file);
    });
    
    // Build folder structure mapping
    const folderStructure = {};
    selectedStructure.value.files.forEach(fileObj => {
      folderStructure[fileObj.file.name] = fileObj.relativePath;
    });
    formData.append('folderStructure', JSON.stringify(folderStructure));
    
    // Add upload options
    if (targetPath.value.trim()) {
      formData.append('targetPath', targetPath.value.trim());
    }
    formData.append('conflictResolution', conflictResolution.value);
    
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
      
      // Clear uploaded files
      clearSelection();
      
      // Emit success event
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

const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    // Could emit event or show toast notification
    console.log('URL copied to clipboard');
  });
};
</script>

<style scoped>
.folder-drop-zone {
  padding: 1rem;
}

.dropzone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f9f9f9;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropzone:hover {
  border-color: #007bff;
  background: #f0f8ff;
  transform: translateY(-2px);
}

.dropzone.dragging {
  border-color: #28a745;
  background: #e8f5e9;
  transform: scale(1.02);
}

.dropzone.folder-detected {
  border-color: #ffc107;
  background: #fff3cd;
}

.dropzone.has-files {
  border-color: #28a745;
  background: #d4edda;
}

.dropzone-content {
  text-align: center;
}

.dropzone i {
  font-size: 4rem;
  color: #666;
  margin-bottom: 1rem;
  display: block;
}

.dropzone h3 {
  margin: 0.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.dropzone p {
  margin: 0.5rem 0;
  color: #666;
  font-size: 1rem;
}

.file-types {
  font-size: 0.875rem !important;
  color: #999 !important;
}

.capability-info {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #1976d2;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.structure-preview {
  margin-top: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.preview-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
}

.clear-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.clear-btn:hover {
  background: #c82333;
}

.folder-tree {
  max-height: 400px;
  overflow-y: auto;
  padding: 1rem;
}

.upload-controls {
  padding: 1rem;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
}

.control-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #555;
}

.path-input, .conflict-select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.upload-btn {
  padding: 0.75rem 2rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  min-height: 48px;
}

.upload-btn:hover:not(:disabled) {
  background: #218838;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .upload-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .control-group {
    min-width: auto;
  }
  
  .upload-btn {
    justify-content: center;
  }
}
</style>