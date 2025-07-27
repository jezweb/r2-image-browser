<template>
  <div class="upload-progress-tree">
    <div class="progress-header">
      <h3>
        <i class="pi pi-cloud-upload"></i>
        Upload Results
      </h3>
      <div class="progress-summary">
        <span class="success-count">{{ successCount }} successful</span>
        <span class="failed-count" v-if="failedCount > 0">{{ failedCount }} failed</span>
        <span class="skipped-count" v-if="skippedCount > 0">{{ skippedCount }} skipped</span>
      </div>
    </div>
    
    <div class="progress-content">
      <!-- Group by status for better organization -->
      <div v-if="successfulUploads.length > 0" class="status-group">
        <div class="status-header success">
          <i class="pi pi-check-circle"></i>
          <span>Successfully Uploaded ({{ successfulUploads.length }})</span>
          <button @click="toggleGroup('success')" class="toggle-btn">
            <i :class="groupExpanded.success ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          </button>
        </div>
        
        <div v-if="groupExpanded.success" class="status-items">
          <div 
            v-for="item in successfulUploads" 
            :key="item.id || item.originalName"
            class="progress-item success"
          >
            <div class="item-info">
              <i class="pi pi-file item-icon"></i>
              <div class="item-details">
                <span class="item-name">{{ item.originalName }}</span>
                <span class="item-path">{{ item.finalPath }}</span>
                <span v-if="item.note" class="item-note">{{ item.note }}</span>
              </div>
              <div class="item-actions">
                <span class="item-size">{{ formatFileSize(item.size) }}</span>
                <button 
                  v-if="item.url" 
                  @click="copyUrl(item.url)"
                  class="copy-btn"
                  title="Copy URL"
                >
                  <i class="pi pi-copy"></i>
                </button>
                <button 
                  v-if="item.url" 
                  @click="openUrl(item.url)"
                  class="view-btn"
                  title="View Image"
                >
                  <i class="pi pi-external-link"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Skipped uploads -->
      <div v-if="skippedUploads.length > 0" class="status-group">
        <div class="status-header warning">
          <i class="pi pi-exclamation-triangle"></i>
          <span>Skipped Files ({{ skippedUploads.length }})</span>
          <button @click="toggleGroup('skipped')" class="toggle-btn">
            <i :class="groupExpanded.skipped ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          </button>
        </div>
        
        <div v-if="groupExpanded.skipped" class="status-items">
          <div 
            v-for="item in skippedUploads" 
            :key="item.id || item.originalName"
            class="progress-item warning"
          >
            <div class="item-info">
              <i class="pi pi-file item-icon"></i>
              <div class="item-details">
                <span class="item-name">{{ item.originalName }}</span>
                <span class="item-path">{{ item.finalPath }}</span>
                <span class="item-note">{{ item.note || 'File already exists' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Failed uploads -->
      <div v-if="failedUploads.length > 0" class="status-group">
        <div class="status-header error">
          <i class="pi pi-times-circle"></i>
          <span>Failed Uploads ({{ failedUploads.length }})</span>
          <button @click="toggleGroup('failed')" class="toggle-btn">
            <i :class="groupExpanded.failed ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
          </button>
        </div>
        
        <div v-if="groupExpanded.failed" class="status-items">
          <div 
            v-for="item in failedUploads" 
            :key="item.id || item.originalName"
            class="progress-item error"
          >
            <div class="item-info">
              <i class="pi pi-file item-icon"></i>
              <div class="item-details">
                <span class="item-name">{{ item.originalName }}</span>
                <span class="item-error">{{ item.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Overall progress bar for active uploads -->
      <div v-if="hasActiveUploads" class="overall-progress">
        <div class="progress-bar-container">
          <div 
            class="progress-bar"
            :style="{ width: overallProgress + '%' }"
          ></div>
        </div>
        <span class="progress-text">{{ overallProgress.toFixed(1) }}% complete</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  progress: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['copy-url']);

// Group expansion state
const groupExpanded = ref({
  success: true,
  skipped: true,
  failed: true
});

// Computed properties for organizing progress items
const successfulUploads = computed(() => 
  props.progress.filter(item => item.status === 'success')
);

const skippedUploads = computed(() => 
  props.progress.filter(item => item.status === 'skipped')
);

const failedUploads = computed(() => 
  props.progress.filter(item => item.status === 'failed' || item.status === 'error')
);

const successCount = computed(() => successfulUploads.value.length);
const skippedCount = computed(() => skippedUploads.value.length);
const failedCount = computed(() => failedUploads.value.length);

const hasActiveUploads = computed(() => 
  props.progress.some(item => item.status === 'uploading' || item.status === 'pending')
);

const overallProgress = computed(() => {
  if (props.progress.length === 0) return 0;
  
  const completed = props.progress.filter(item => 
    ['success', 'failed', 'error', 'skipped'].includes(item.status)
  ).length;
  
  return (completed / props.progress.length) * 100;
});

// Methods
const toggleGroup = (groupName) => {
  groupExpanded.value[groupName] = !groupExpanded.value[groupName];
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    // Could show a toast or temporary feedback
    console.log('URL copied:', url);
  }).catch(err => {
    console.error('Failed to copy URL:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  });
  
  emit('copy-url', url);
};

const openUrl = (url) => {
  window.open(url, '_blank');
};

// Auto-expand groups when new items are added
watch(() => props.progress, (newProgress) => {
  // Auto-expand relevant groups when new results come in
  if (newProgress.some(item => item.status === 'failed' || item.status === 'error')) {
    groupExpanded.value.failed = true;
  }
}, { deep: true });
</script>

<style scoped>
.upload-progress-tree {
  margin-top: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.progress-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #333;
  font-size: 1.125rem;
}

.progress-summary {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.success-count {
  color: #28a745;
  font-weight: 500;
}

.failed-count {
  color: #dc3545;
  font-weight: 500;
}

.skipped-count {
  color: #ffc107;
  font-weight: 500;
}

.progress-content {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.status-group {
  margin-bottom: 1.5rem;
}

.status-group:last-child {
  margin-bottom: 0;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.status-header:hover {
  opacity: 0.9;
}

.status-header.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-header.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-header.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  margin-left: auto;
  border-radius: 2px;
  color: inherit;
  font-size: 0.75rem;
}

.toggle-btn:hover {
  background: rgba(0,0,0,0.1);
}

.status-items {
  margin-top: 0.5rem;
  padding-left: 1rem;
  border-left: 3px solid #e9ecef;
}

.progress-item {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.progress-item:hover {
  background: #f8f9fa;
}

.progress-item.success {
  border-left: 3px solid #28a745;
}

.progress-item.warning {
  border-left: 3px solid #ffc107;
}

.progress-item.error {
  border-left: 3px solid #dc3545;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.item-icon {
  color: #6c757d;
  font-size: 1rem;
  flex-shrink: 0;
}

.item-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 500;
  color: #333;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.item-path {
  font-size: 0.875rem;
  color: #6c757d;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.item-note {
  font-size: 0.75rem;
  color: #856404;
  font-style: italic;
}

.item-error {
  font-size: 0.875rem;
  color: #dc3545;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.item-size {
  font-size: 0.75rem;
  color: #6c757d;
}

.copy-btn, .view-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.375rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: #0056b3;
}

.view-btn {
  background: #6c757d;
}

.view-btn:hover {
  background: #545b62;
}

.overall-progress {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #28a745);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6c757d;
  text-align: center;
  display: block;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .progress-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .progress-summary {
    justify-content: center;
  }
  
  .item-info {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .item-actions {
    justify-content: space-between;
  }
  
  .status-items {
    padding-left: 0.5rem;
  }
}
</style>