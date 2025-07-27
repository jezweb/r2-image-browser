<template>
  <Dialog 
    v-model:visible="visible" 
    modal 
    header="📁 Upload Folder" 
    :style="{ width: '650px', maxWidth: '90vw' }"
    :dismissableMask="false"
    class="folder-upload-modal">
    
    <!-- Clear Instructions -->
    <div class="instructions-section mb-3">
      <p class="text-gray-600 text-sm">
        Upload all files and subfolders at once while preserving your folder structure.
      </p>
    </div>

    <!-- Browser Compatibility Warning -->
    <Message v-if="!isBrowserCompatible" severity="warn" :closable="false" class="mb-4">
      <div class="flex align-items-center">
        <i class="pi pi-exclamation-triangle mr-2"></i>
        <div>
          <strong>Browser Not Supported</strong>
          <p class="mt-1">Folder upload requires Chrome, Edge, or Opera browser.</p>
          <div class="mt-2">
            <Button 
              label="Download Chrome" 
              @click="openBrowserDownload('chrome')" 
              size="small" 
              outlined 
              class="mr-2" />
            <Button 
              label="Use File Upload Instead" 
              @click="switchToFileUpload" 
              size="small" 
              severity="secondary" />
          </div>
        </div>
      </div>
    </Message>

    <!-- Folder Selection Area -->
    <div 
      v-if="isBrowserCompatible"
      class="folder-drop-zone"
      :class="{ 'drag-over': isDragging }"
      @drop="handleDrop"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @click="triggerFolderSelect">
      
      <input
        ref="folderInput"
        type="file"
        webkitdirectory
        directory
        multiple
        @change="handleFolderSelect"
        style="display: none;" />
      
      <div class="drop-zone-content">
        <i class="pi pi-folder-open" style="font-size: 3rem; color: var(--primary-color);"></i>
        <h4 class="mt-2 mb-1">{{ isDragging ? 'Drop your folder here' : 'Select or Drop a Folder' }}</h4>
        <p class="text-gray-600 text-sm mb-3">
          {{ isDragging ? 'Release to upload this folder' : 'Click to browse or drag & drop a folder here' }}
        </p>
        <Button 
          v-if="!isDragging"
          label="Select Folder" 
          icon="pi pi-folder" 
          severity="primary"
          size="small" />
      </div>
    </div>

    <!-- Divider -->
    <Divider v-if="folderPreview && folderPreview.length > 0" />
    
    <!-- Folder Structure Preview -->
    <div v-if="folderPreview && folderPreview.length > 0" class="folder-preview">
      <div class="preview-header flex justify-content-between align-items-center mb-2">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-eye text-gray-600"></i>
          <span class="font-semibold">Preview</span>
        </div>
        <Tag :value="`${totalFiles} files`" severity="info" size="small" />
      </div>
      
      <div class="preview-tree">
        <Tree 
          :value="folderPreview" 
          :expandedKeys="expandedKeys"
          @node-expand="onNodeExpand"
          @node-collapse="onNodeCollapse"
          class="folder-tree">
          <template #default="slotProps">
            <div class="tree-node-content">
              <span class="node-label">
                <i :class="getNodeIcon(slotProps.node)" class="mr-1 text-primary"></i>
                {{ slotProps.node.label }}
              </span>
              <Tag 
                v-if="slotProps.node.data && slotProps.node.data.fileCount > 0" 
                :value="slotProps.node.data.fileCount" 
                severity="secondary" 
                size="small" />
            </div>
          </template>
        </Tree>
      </div>

      <!-- Upload Options -->
      <Card class="upload-options-card mt-3">
        <template #content>
          <div class="grid">
            <div class="col-12 md:col-6">
              <div class="field">
                <label class="text-sm font-semibold text-gray-700 mb-2 block">Upload to:</label>
                <div class="flex flex-column gap-2">
                  <div class="flex align-items-center">
                    <RadioButton v-model="uploadLocation" inputId="root" value="root" />
                    <label for="root" class="ml-2 cursor-pointer">Root folder</label>
                  </div>
                  <div class="flex align-items-center">
                    <RadioButton v-model="uploadLocation" inputId="custom" value="custom" />
                    <label for="custom" class="ml-2 cursor-pointer">Custom folder</label>
                  </div>
                  <InputText 
                    v-model="customPath" 
                    :disabled="uploadLocation !== 'custom'"
                    placeholder="e.g., categories/2024"
                    class="ml-4"
                    size="small" />
                </div>
              </div>
            </div>
            <div class="col-12 md:col-6">
              <div class="field">
                <label class="text-sm font-semibold text-gray-700 mb-2 block">If files already exist:</label>
                <Dropdown 
                  v-model="conflictResolution" 
                  :options="conflictOptions" 
                  optionLabel="label" 
                  optionValue="value"
                  class="w-full"
                  size="small" />
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Upload Progress -->
    <div v-if="isUploading" class="upload-progress mt-4">
      <h4 class="mb-3">📤 Uploading...</h4>
      <ProgressBar :value="uploadProgress" :showValue="true" />
      <p class="text-sm text-gray-600 mt-2">
        {{ uploadedFiles }} of {{ totalFiles }} files uploaded
      </p>
      <div v-if="currentFile" class="current-file mt-2">
        <small class="text-gray-500">Currently uploading: {{ currentFile }}</small>
      </div>
    </div>

    <!-- Success Message -->
    <Message v-if="uploadComplete" severity="success" :closable="false" class="mt-4">
      <div class="flex align-items-center">
        <i class="pi pi-check-circle mr-2"></i>
        <div>
          <strong>Upload Complete!</strong>
          <p class="mt-1">Successfully uploaded {{ uploadedFiles }} files.</p>
        </div>
      </div>
    </Message>

    <!-- Footer Actions -->
    <template #footer>
      <Button 
        label="Cancel" 
        @click="handleCancel" 
        text 
        :disabled="isUploading" />
      <Button 
        v-if="!uploadComplete"
        label="Upload" 
        icon="pi pi-upload"
        @click="startUpload" 
        :disabled="!folderPreview || folderPreview.length === 0 || isUploading"
        :loading="isUploading" />
      <Button 
        v-else
        label="Upload Another Folder" 
        icon="pi pi-refresh"
        @click="resetModal" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tree from 'primevue/tree'
import Tag from 'primevue/tag'
import RadioButton from 'primevue/radiobutton'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import ProgressBar from 'primevue/progressbar'
import Divider from 'primevue/divider'
import Card from 'primevue/card'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'upload-complete', 'switch-to-file-upload'])

const toast = useToast()

// Browser compatibility
const isBrowserCompatible = ref(false)

// Upload state
const isDragging = ref(false)
const folderInput = ref(null)
const selectedFiles = ref([])
const folderPreview = ref([])
const expandedKeys = ref({})
const totalFiles = ref(0)

// Upload options
const uploadLocation = ref('root')
const customPath = ref('')
const conflictResolution = ref('rename')
const conflictOptions = [
  { label: 'Rename files (add number)', value: 'rename' },
  { label: 'Skip existing files', value: 'skip' },
  { label: 'Overwrite existing files', value: 'overwrite' }
]

// Upload progress
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadedFiles = ref(0)
const currentFile = ref('')
const uploadComplete = ref(false)

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Methods
const checkBrowserCompatibility = () => {
  const input = document.createElement('input')
  input.type = 'file'
  isBrowserCompatible.value = 'webkitdirectory' in input || 'directory' in input
}

const openBrowserDownload = (browser) => {
  const urls = {
    chrome: 'https://www.google.com/chrome/',
    edge: 'https://www.microsoft.com/edge'
  }
  window.open(urls[browser], '_blank')
}

const switchToFileUpload = () => {
  visible.value = false
  emit('switch-to-file-upload')
}

const triggerFolderSelect = () => {
  if (folderInput.value) {
    folderInput.value.click()
  }
}

const handleDrop = async (e) => {
  e.preventDefault()
  isDragging.value = false
  
  const items = Array.from(e.dataTransfer.items)
  const entries = []
  
  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : item.getAsEntry()
      if (entry && entry.isDirectory) {
        entries.push(entry)
      }
    }
  }
  
  if (entries.length > 0) {
    await processDirectoryEntries(entries)
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Invalid Selection',
      detail: 'Please drop a folder, not individual files.',
      life: 3000
    })
  }
}

const handleFolderSelect = async (e) => {
  const files = Array.from(e.target.files)
  if (files.length > 0) {
    await processSelectedFiles(files)
  }
}

const processSelectedFiles = async (files) => {
  selectedFiles.value = files
  
  // Build folder structure for preview
  const structure = buildFolderStructure(files)
  folderPreview.value = structure
  totalFiles.value = files.length
  
  // Auto-expand first level
  if (structure.length > 0) {
    expandedKeys.value = { [structure[0].key]: true }
  }
}

const processDirectoryEntries = async (entries) => {
  const files = []
  
  for (const entry of entries) {
    const entryFiles = await readDirectoryEntry(entry)
    files.push(...entryFiles)
  }
  
  await processSelectedFiles(files)
}

const readDirectoryEntry = async (entry, path = '') => {
  const files = []
  
  if (entry.isFile) {
    const file = await new Promise((resolve) => {
      entry.file(resolve)
    })
    // Add relative path to file
    file.relativePath = path + file.name
    files.push(file)
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    const entries = await new Promise((resolve) => {
      reader.readEntries(resolve)
    })
    
    for (const childEntry of entries) {
      const childFiles = await readDirectoryEntry(childEntry, path + entry.name + '/')
      files.push(...childFiles)
    }
  }
  
  return files
}

const buildFolderStructure = (files) => {
  const root = {
    key: '0',
    label: files[0]?.webkitRelativePath?.split('/')[0] || 'Selected Folder',
    icon: 'pi pi-folder',
    data: { fileCount: 0, isRoot: true },
    children: []
  }
  
  const folderMap = new Map()
  folderMap.set('', root)
  
  // Process each file
  files.forEach((file) => {
    const pathParts = (file.webkitRelativePath || file.relativePath || file.name).split('/')
    let currentPath = ''
    let parentFolder = root
    
    // Build folder hierarchy
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i]
      const newPath = currentPath ? `${currentPath}/${folderName}` : folderName
      
      if (!folderMap.has(newPath)) {
        const newFolder = {
          key: newPath,
          label: folderName,
          icon: 'pi pi-folder',
          data: { fileCount: 0 },
          children: []
        }
        
        parentFolder.children.push(newFolder)
        folderMap.set(newPath, newFolder)
      }
      
      currentPath = newPath
      parentFolder = folderMap.get(newPath)
    }
    
    // Increment file counts
    let path = ''
    for (let i = 0; i < pathParts.length - 1; i++) {
      path = path ? `${path}/${pathParts[i]}` : pathParts[i]
      const folder = folderMap.get(path)
      if (folder) {
        folder.data.fileCount++
      }
    }
    root.data.fileCount++
  })
  
  return [root]
}

const getNodeIcon = (node) => {
  if (node.data?.isRoot) return 'pi pi-folder-open'
  return node.icon || 'pi pi-folder'
}

const onNodeExpand = (node) => {
  expandedKeys.value[node.key] = true
}

const onNodeCollapse = (node) => {
  delete expandedKeys.value[node.key]
}

const startUpload = async () => {
  isUploading.value = true
  uploadProgress.value = 0
  uploadedFiles.value = 0
  
  try {
    const basePath = uploadLocation.value === 'custom' ? customPath.value : ''
    const formData = new FormData()
    
    // Build folder structure mapping
    const folderStructure = {}
    selectedFiles.value.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.relativePath || file.name
      const targetPath = basePath ? `${basePath}/${relativePath}` : relativePath
      folderStructure[file.name] = targetPath
      formData.append('files', file)
    })
    
    formData.append('folderStructure', JSON.stringify(folderStructure))
    formData.append('conflictResolution', conflictResolution.value)
    
    // Upload with progress tracking
    const response = await uploadWithProgress(formData)
    
    if (response.success) {
      uploadComplete.value = true
      toast.add({
        severity: 'success',
        summary: 'Upload Complete',
        detail: `Successfully uploaded ${uploadedFiles.value} files`,
        life: 5000
      })
      emit('upload-complete', response.data)
    } else {
      throw new Error(response.error || 'Upload failed')
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Upload Failed',
      detail: error.message,
      life: 5000
    })
  } finally {
    isUploading.value = false
  }
}

const uploadWithProgress = async (formData) => {
  // Simulate progress for demo
  // In real implementation, use XMLHttpRequest for progress events
  const totalSteps = selectedFiles.value.length
  
  for (let i = 0; i < totalSteps; i++) {
    currentFile.value = selectedFiles.value[i].name
    uploadedFiles.value = i + 1
    uploadProgress.value = Math.round(((i + 1) / totalSteps) * 100)
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Make actual API call
  const response = await fetch('/api/upload/batch', {
    method: 'POST',
    body: formData
  })
  
  return await response.json()
}

const handleCancel = () => {
  if (!isUploading.value) {
    visible.value = false
    resetModal()
  }
}

const resetModal = () => {
  selectedFiles.value = []
  folderPreview.value = []
  totalFiles.value = 0
  uploadProgress.value = 0
  uploadedFiles.value = 0
  currentFile.value = ''
  uploadComplete.value = false
  expandedKeys.value = {}
  uploadLocation.value = 'root'
  customPath.value = ''
}

// Initialize
checkBrowserCompatibility()

// Watch for modal close
watch(visible, (newVal) => {
  if (!newVal) {
    resetModal()
  }
})
</script>

<style scoped>
.folder-upload-modal :deep(.p-dialog-content) {
  padding: 2rem;
}

.folder-upload-modal :deep(.p-dialog-header) {
  padding: 1.5rem 2rem 1rem 2rem;
}

.instructions-section {
  margin-bottom: 1.5rem;
}

.instructions-section p {
  margin: 0;
  line-height: 1.5;
}

.folder-drop-zone {
  border: 2px dashed var(--surface-border);
  border-radius: 8px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--surface-50);
  margin-bottom: 1.5rem;
}

.folder-drop-zone:hover {
  border-color: var(--primary-color);
  background-color: var(--surface-100);
}

.folder-drop-zone.drag-over {
  border-color: var(--primary-color);
  background-color: var(--primary-100);
  transform: scale(1.01);
}

.drop-zone-content {
  pointer-events: none;
}

.drop-zone-content h4 {
  margin: 1rem 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.drop-zone-content p {
  margin: 0 0 1.5rem 0;
  line-height: 1.4;
}

.folder-preview {
  margin-top: 1rem;
}

.preview-header {
  padding: 0.5rem 0;
}

.preview-tree {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 0.75rem;
  background-color: var(--surface-0);
}

.tree-node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.25rem 0;
}

.node-label {
  display: flex;
  align-items: center;
  flex: 1;
}

.upload-options-card {
  margin-top: 1.5rem !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: var(--surface-50);
}

.upload-options-card :deep(.p-card-content) {
  padding: 1.5rem;
}

:deep(.p-tree) {
  border: none;
  padding: 0;
}

:deep(.p-treenode-content) {
  padding: 0.25rem 0.5rem;
}

:deep(.p-treenode-label) {
  padding: 0;
}

.upload-progress {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  background-color: var(--surface-50);
}

.current-file {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field {
  margin-bottom: 0;
}

.field label {
  display: block;
}

@media (max-width: 768px) {
  .folder-upload-modal :deep(.p-dialog) {
    width: 95vw !important;
    margin: 0.5rem;
  }
  
  .folder-upload-modal :deep(.p-dialog-content) {
    padding: 1.5rem;
  }
  
  .folder-upload-modal :deep(.p-dialog-header) {
    padding: 1rem 1.5rem 0.5rem 1.5rem;
  }
  
  .folder-drop-zone {
    padding: 2rem 1rem;
    margin-bottom: 1rem;
  }
  
  .upload-options-card :deep(.p-card-content) {
    padding: 1rem;
  }
}
</style>