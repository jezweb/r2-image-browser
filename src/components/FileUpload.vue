<template>
  <div class="upload-container">
    <div 
      :class="['dropzone', { 'dragging': isDragging }]"
      @drop="handleDrop"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @click="$refs.fileInput.click()"
    >
      <i class="pi pi-upload"></i>
      <p>Drag and drop images here or click to browse</p>
      <p class="file-types">Supported: PNG, JPG, GIF, SVG, WebP (Max 10MB)</p>
      <input 
        ref="fileInput"
        type="file" 
        multiple 
        accept="image/*"
        style="display: none"
        @change="handleFileSelect"
      >
    </div>

    <!-- Selected Files Preview -->
    <div v-if="selectedFiles.length > 0" class="files-preview">
      <h3>Selected Files ({{ selectedFiles.length }})</h3>
      <div class="file-list">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <img v-if="file.preview" :src="file.preview" alt="Preview" class="file-preview">
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
            <span v-if="file.error" class="file-error">{{ file.error }}</span>
          </div>
          <button @click="removeFile(index)" class="remove-btn">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Upload Controls -->
    <div v-if="selectedFiles.length > 0" class="upload-controls">
      <select v-model="targetFolder" class="folder-select">
        <option value="">Root Directory</option>
        <option v-for="folder in folders" :key="folder.name" :value="folder.name">
          {{ folder.name }}
        </option>
      </select>
      <button 
        @click="uploadFiles" 
        :disabled="isUploading"
        class="upload-btn"
      >
        <i :class="isUploading ? 'pi pi-spin pi-spinner' : 'pi pi-cloud-upload'"></i>
        {{ isUploading ? 'Uploading...' : 'Upload Files' }}
      </button>
    </div>

    <!-- Upload Progress -->
    <div v-if="uploadProgress.length > 0" class="upload-progress">
      <h3>Upload Progress</h3>
      <div v-for="(progress, index) in uploadProgress" :key="index" class="progress-item">
        <div class="progress-info">
          <span>{{ progress.name }}</span>
          <span :class="['progress-status', progress.status]">
            {{ progress.status === 'success' ? 'Uploaded' : progress.status === 'error' ? 'Failed' : 'Uploading...' }}
          </span>
        </div>
        <div v-if="progress.error" class="progress-error">{{ progress.error }}</div>
        <div v-if="progress.url" class="progress-url">
          <button @click="copyUrl(progress.url)" class="copy-btn">
            <i class="pi pi-copy"></i> Copy URL
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
  folders: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['uploaded']);

const authHeader = inject('authHeader');
const toast = useToast();
const isDragging = ref(false);
const selectedFiles = ref([]);
const targetFolder = ref('');
const isUploading = ref(false);
const uploadProgress = ref([]);

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const handleDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
  processFiles(e.dataTransfer.files);
};

const handleFileSelect = (e) => {
  processFiles(e.target.files);
};

const processFiles = (files) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  for (const file of files) {
    const fileObj = {
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: null,
      error: null
    };
    
    // Validate file
    if (!allowedTypes.includes(file.type)) {
      fileObj.error = 'Invalid file type';
    } else if (file.size > maxSize) {
      fileObj.error = `File too large (max 10MB)`;
    } else {
      // Create preview for images
      const reader = new FileReader();
      reader.onload = (e) => {
        fileObj.preview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
    
    selectedFiles.value.push(fileObj);
  }
};

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
};

const uploadFiles = async () => {
  if (isUploading.value) return;
  
  const validFiles = selectedFiles.value.filter(f => !f.error);
  if (validFiles.length === 0) {
    toast.add({ 
      severity: 'warn', 
      summary: 'No valid files', 
      detail: 'Please select valid files to upload',
      life: 3000 
    });
    return;
  }
  
  isUploading.value = true;
  uploadProgress.value = [];
  
  const formData = new FormData();
  formData.append('folder', targetFolder.value);
  
  validFiles.forEach(fileObj => {
    formData.append('files', fileObj.file);
    uploadProgress.value.push({
      name: fileObj.name,
      status: 'uploading',
      error: null,
      url: null
    });
  });
  
  try {
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update progress with results
      result.results.forEach((res, index) => {
        uploadProgress.value[index] = {
          name: res.name,
          status: res.success ? 'success' : 'error',
          error: res.error || null,
          url: res.url || null
        };
      });
      
      // Clear successfully uploaded files
      selectedFiles.value = selectedFiles.value.filter(f => 
        !result.results.find(r => r.name === f.name && r.success)
      );
      
      // Emit event to refresh the file list
      emit('uploaded');
    } else {
      uploadProgress.value = [{
        name: 'Upload failed',
        status: 'error',
        error: result.error || 'Unknown error'
      }];
    }
  } catch (error) {
    uploadProgress.value = [{
      name: 'Upload failed',
      status: 'error',
      error: error.message
    }];
  } finally {
    isUploading.value = false;
  }
};

const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    toast.add({ 
      severity: 'success', 
      summary: 'Copied!', 
      detail: 'URL copied to clipboard',
      life: 2000 
    });
  }).catch(() => {
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Failed to copy URL',
      life: 3000 
    });
  });
};
</script>

<style scoped>
.upload-container {
  padding: 1rem;
}

.dropzone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #f9f9f9;
}

.dropzone:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.dropzone.dragging {
  border-color: #28a745;
  background: #e8f5e9;
}

.dropzone i {
  font-size: 3rem;
  color: #666;
  margin-bottom: 1rem;
  display: block;
}

.dropzone p {
  margin: 0.5rem 0;
  color: #666;
}

.file-types {
  font-size: 0.875rem;
  color: #999;
}

.files-preview {
  margin-top: 2rem;
}

.files-preview h3 {
  margin-bottom: 1rem;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 4px;
  gap: 1rem;
}

.file-preview {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-weight: 500;
}

.file-size {
  font-size: 0.875rem;
  color: #666;
}

.file-error {
  font-size: 0.875rem;
  color: #dc3545;
}

.remove-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 0.5rem;
  font-size: 1.2rem;
}

.upload-controls {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.folder-select {
  flex: 1;
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
}

.upload-btn:hover:not(:disabled) {
  background: #218838;
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-progress {
  margin-top: 2rem;
}

.upload-progress h3 {
  margin-bottom: 1rem;
}

.progress-item {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-status {
  font-size: 0.875rem;
  font-weight: 500;
}

.progress-status.success {
  color: #28a745;
}

.progress-status.error {
  color: #dc3545;
}

.progress-status.uploading {
  color: #007bff;
}

.progress-error {
  font-size: 0.875rem;
  color: #dc3545;
  margin-top: 0.25rem;
}

.progress-url {
  margin-top: 0.5rem;
}

.copy-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.copy-btn:hover {
  background: #0056b3;
}
</style>