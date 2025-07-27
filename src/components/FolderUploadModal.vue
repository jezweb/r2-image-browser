<template>
  <!-- Folder Upload Modal v2 - Enhanced Design -->
  <Dialog 
    v-model:visible="visible" 
    modal 
    :style="{ width: '750px', maxWidth: '95vw' }"
    :dismissableMask="false"
    :draggable="false"
    class="folder-upload-modal-v2">
    
    <template #header>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span style="width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; background-color: #e3f2fd;">
          <i class="pi pi-folder-open" style="font-size: 1.5rem; color: #1976d2;"></i>
        </span>
        <div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">Upload Folder</h2>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #6c757d;">Upload entire folders while preserving structure</p>
        </div>
      </div>
    </template>

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
    <div v-if="isBrowserCompatible" class="mb-4">
      <div 
        class="folder-drop-zone"
        :class="{ 'drag-over': isDragging }"
        @drop="handleDrop"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @click="triggerFolderSelect"
        style="border: 2px dashed #dee2e6; border-radius: 12px; padding: 3rem 2rem; text-align: center; cursor: pointer; background-color: #f8f9fa; transition: all 0.3s;">
        
        <input
          ref="folderInput"
          type="file"
          webkitdirectory
          directory
          multiple
          @change="handleFolderSelect"
          style="display: none;" />
        
        <div class="drop-zone-content">
          <i class="pi pi-cloud-upload" 
             style="font-size: 4rem; color: #6c757d; display: block; margin-bottom: 1rem;"></i>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 600; color: #212529;">
            {{ isDragging ? 'Drop your folder here' : 'Choose a folder to upload (v2)' }}
          </h3>
          <p style="margin: 0 0 1.5rem 0; color: #6c757d;">
            {{ isDragging ? 'Release to start uploading' : 'Drag and drop a folder here, or click to browse' }}
          </p>
          <Button 
            v-if="!isDragging"
            label="Browse Folders" 
            icon="pi pi-folder-open" 
            severity="primary" />
        </div>
      </div>
    </div>

    <!-- Divider -->
    <Divider v-if="folderPreview && folderPreview.length > 0" />
    
    <!-- Folder Structure Preview -->
    <div v-if="folderPreview && folderPreview.length > 0" class="mb-4">
      <div class="flex justify-content-between align-items-center mb-3">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-eye text-500"></i>
          <span class="font-semibold text-900">Folder Preview</span>
        </div>
        <Chip :label="`${totalFiles} files`" icon="pi pi-file" />
      </div>
      
      <Card class="surface-50">
        <template #content>
          <Tree 
            :value="folderPreview" 
            :expandedKeys="expandedKeys"
            @node-expand="onNodeExpand"
            @node-collapse="onNodeCollapse"
            class="p-0">
            <template #default="slotProps">
              <div class="flex align-items-center justify-content-between flex-1">
                <span class="flex align-items-center gap-2">
                  <i :class="getNodeIcon(slotProps.node)" class="text-primary"></i>
                  <span class="font-medium">{{ slotProps.node.label }}</span>
                </span>
                <Badge 
                  v-if="slotProps.node.data && slotProps.node.data.fileCount > 0" 
                  :value="slotProps.node.data.fileCount" 
                  severity="secondary" />
              </div>
            </template>
          </Tree>
        </template>
      </Card>

      <!-- Upload Options -->
      <Fieldset legend="Upload Options" class="mt-4">
        <div class="grid">
          <div class="col-12 md:col-6">
            <div class="field">
              <label class="block mb-2 font-semibold text-900">Destination</label>
              <div class="flex flex-column gap-3">
                <div class="flex align-items-center">
                  <RadioButton v-model="uploadLocation" inputId="root" value="root" />
                  <label for="root" class="ml-2 cursor-pointer">
                    <i class="pi pi-home mr-2 text-500"></i>Root folder
                  </label>
                </div>
                <div class="flex align-items-center">
                  <RadioButton v-model="uploadLocation" inputId="custom" value="custom" />
                  <label for="custom" class="ml-2 cursor-pointer">
                    <i class="pi pi-folder mr-2 text-500"></i>Specific folder
                  </label>
                </div>
                <InputText 
                  v-model="customPath" 
                  :disabled="uploadLocation !== 'custom'"
                  placeholder="e.g., projects/2024"
                  class="ml-5 flex-1" />
              </div>
            </div>
          </div>
          <div class="col-12 md:col-6">
            <div class="field">
              <label for="conflict" class="block mb-2 font-semibold text-900">Conflict Resolution</label>
              <Dropdown 
                inputId="conflict"
                v-model="conflictResolution" 
                :options="conflictOptions" 
                optionLabel="label" 
                optionValue="value"
                class="w-full" />
            </div>
          </div>
        </div>
      </Fieldset>
    </div>

    <!-- Upload Progress -->
    <Card v-if="isUploading" class="mt-4 surface-50">
      <template #content>
        <div class="text-center">
          <i class="pi pi-cloud-upload text-4xl text-primary mb-3 p-animation-pulse"></i>
          <h3 class="mt-0 mb-3 text-900">Uploading Files</h3>
          <ProgressBar 
            :value="uploadProgress" 
            :showValue="true"
            class="mb-3"
            style="height: 1.5rem">
            <template #default="slotProps">
              <span class="text-sm font-semibold">{{ slotProps.value }}%</span>
            </template>
          </ProgressBar>
          <div class="flex justify-content-between align-items-center text-600 mb-2">
            <span class="text-sm">
              <i class="pi pi-file mr-1"></i>
              {{ uploadedFiles }} of {{ totalFiles }} files
            </span>
            <span class="text-sm">
              <i class="pi pi-clock mr-1"></i>
              {{ Math.round((totalFiles - uploadedFiles) * 0.5) }}s remaining
            </span>
          </div>
          <div v-if="currentFile" class="mt-3 p-2 surface-100 border-round">
            <small class="text-600">
              <i class="pi pi-spinner pi-spin mr-2"></i>
              {{ currentFile }}
            </small>
          </div>
        </div>
      </template>
    </Card>

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
import { ref, computed, watch, inject } from 'vue'
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
import Chip from 'primevue/chip'
import Badge from 'primevue/badge'
import Fieldset from 'primevue/fieldset'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'upload-complete', 'switch-to-file-upload'])

const toast = useToast()

// Get auth header
const authHeader = inject('authHeader')

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
  // Pre-upload validation
  if (!selectedFiles.value || selectedFiles.value.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'No Files Selected',
      detail: 'Please select a folder to upload first.',
      life: 4000
    })
    return
  }
  
  // Validate custom path if specified
  if (uploadLocation.value === 'custom') {
    if (!customPath.value.trim()) {
      toast.add({
        severity: 'warn',
        summary: 'Invalid Path',
        detail: 'Please enter a custom folder path or select root folder.',
        life: 4000
      })
      return
    }
    
    // Basic path validation
    if (customPath.value.includes('..') || customPath.value.startsWith('/')) {
      toast.add({
        severity: 'warn',
        summary: 'Invalid Path',
        detail: 'Path cannot contain ".." or start with "/". Use relative paths only.',
        life: 4000
      })
      return
    }
  }
  
  // Enhanced file validation
  const fileCount = selectedFiles.value.length
  const validImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico']
  
  // Check file count limits with different tiers
  if (fileCount > 1000) {
    toast.add({
      severity: 'error',
      summary: 'Too Many Files',
      detail: `Selected ${fileCount} files. Maximum is 1000 files per upload. Please select fewer files or split into multiple uploads.`,
      life: 8000
    })
    return
  } else if (fileCount > 500) {
    toast.add({
      severity: 'warn',
      summary: 'Large Upload Warning',
      detail: `Selected ${fileCount} files. This will be processed in multiple batches and may take 10+ minutes.`,
      life: 6000
    })
  }
  
  // Check for non-image files
  const nonImageFiles = selectedFiles.value.filter(file => 
    !validImageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  )
  
  if (nonImageFiles.length > 0) {
    const examples = nonImageFiles.slice(0, 3).map(f => f.name).join(', ')
    const more = nonImageFiles.length > 3 ? ` and ${nonImageFiles.length - 3} more` : ''
    
    toast.add({
      severity: 'info',
      summary: 'Non-Image Files Detected',
      detail: `Found ${nonImageFiles.length} non-image files (${examples}${more}). These will be skipped during upload.`,
      life: 6000
    })
  }
  
  // Calculate total size and provide detailed warnings
  const totalSize = selectedFiles.value.reduce((sum, file) => sum + file.size, 0)
  const totalSizeMB = Math.round(totalSize / (1024 * 1024))
  const avgFileSizeMB = Math.round(totalSizeMB / fileCount * 10) / 10
  
  if (totalSizeMB > 500) {
    toast.add({
      severity: 'warn',
      summary: 'Very Large Upload',
      detail: `Uploading ${totalSizeMB}MB across ${fileCount} files. This will take 15+ minutes and may fail on slow connections.`,
      life: 8000
    })
  } else if (totalSizeMB > 200) {
    toast.add({
      severity: 'info',
      summary: 'Large Upload',
      detail: `Uploading ${totalSizeMB}MB across ${fileCount} files (avg ${avgFileSizeMB}MB each). This may take 5-10 minutes.`,
      life: 6000
    })
  }
  
  // Check for unusually large individual files
  const largeFiles = selectedFiles.value.filter(file => file.size > 10 * 1024 * 1024) // >10MB
  if (largeFiles.length > 0) {
    const examples = largeFiles.slice(0, 2).map(f => `${f.name} (${Math.round(f.size / (1024 * 1024))}MB)`).join(', ')
    
    toast.add({
      severity: 'info',
      summary: 'Large Files Detected',
      detail: `Found ${largeFiles.length} files over 10MB: ${examples}. These may take longer to upload.`,
      life: 6000
    })
  }
  
  isUploading.value = true
  uploadProgress.value = 0
  uploadedFiles.value = 0
  
  try {
    const basePath = uploadLocation.value === 'custom' ? customPath.value.trim() : ''
    const formData = new FormData()
    
    // Build folder structure mapping
    const folderStructure = {}
    const processedFiles = []
    
    selectedFiles.value.forEach((file) => {
      // Skip hidden files and system files
      if (file.name.startsWith('.') && !file.name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i)) {
        return
      }
      
      const relativePath = file.webkitRelativePath || file.relativePath || file.name
      const targetPath = basePath ? `${basePath}/${relativePath}` : relativePath
      folderStructure[file.name] = targetPath
      formData.append('files', file)
      processedFiles.push(file)
    })
    
    // Update total files count after filtering
    totalFiles.value = processedFiles.length
    
    if (processedFiles.length === 0) {
      throw new Error('No valid image files found in the selected folder.')
    }
    
    formData.append('folderStructure', JSON.stringify(folderStructure))
    formData.append('conflictResolution', conflictResolution.value)
    
    // Upload with chunked processing for large batches
    let response
    if (processedFiles.length > 50) {
      response = await uploadInChunks(processedFiles, folderStructure, basePath)
    } else {
      response = await uploadWithProgress(formData)
    }
    
    // Check response and handle success
    if (response && (response.success === true || response.success === undefined)) {
      uploadComplete.value = true
      
      const successCount = response.uploaded || uploadedFiles.value
      const failedCount = response.failed || 0
      
      if (failedCount > 0) {
        toast.add({
          severity: 'warn',
          summary: 'Partial Upload',
          detail: `Uploaded ${successCount} files successfully, ${failedCount} files failed.`,
          life: 6000
        })
      } else {
        toast.add({
          severity: 'success',
          summary: 'Upload Complete',
          detail: `Successfully uploaded ${successCount} files to your image library.`,
          life: 5000
        })
      }
      
      emit('upload-complete', response.data || response)
    } else {
      throw new Error(response.error || response.message || 'Upload failed - invalid response from server')
    }
  } catch (error) {
    console.error('Upload error:', error)
    
    // Provide user-friendly error messages
    let errorDetail = error.message
    
    // Handle common error patterns
    if (errorDetail.includes('Authentication')) {
      errorDetail = 'Authentication failed. Please refresh the page and try again.'
    } else if (errorDetail.includes('Network')) {
      errorDetail = 'Network connection failed. Please check your internet and try again.'
    } else if (errorDetail.includes('timeout')) {
      errorDetail = 'Upload timed out. Try uploading fewer files or check your connection.'
    } else if (errorDetail.includes('too large')) {
      errorDetail = 'Upload is too large. Try uploading fewer files at once.'
    }
    
    toast.add({
      severity: 'error',
      summary: 'Upload Failed',
      detail: errorDetail,
      life: 8000
    })
    
    // Reset upload state on error
    uploadProgress.value = 0
    uploadedFiles.value = 0
    currentFile.value = ''
  } finally {
    isUploading.value = false
  }
}

const uploadInChunks = async (files, folderStructure, basePath) => {
  const CHUNK_SIZE = 25 // Process 25 files at a time
  const chunks = []
  
  // Split files into chunks
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    chunks.push(files.slice(i, i + CHUNK_SIZE))
  }
  
  let totalUploaded = 0
  const results = []
  
  uploadProgress.value = 0
  currentFile.value = `Processing ${chunks.length} batches...`
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkNumber = i + 1
    
    currentFile.value = `Uploading batch ${chunkNumber} of ${chunks.length} (${chunk.length} files)...`
    
    // Create FormData for this chunk
    const formData = new FormData()
    const chunkStructure = {}
    
    chunk.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.relativePath || file.name
      const targetPath = basePath ? `${basePath}/${relativePath}` : relativePath
      chunkStructure[file.name] = targetPath
      formData.append('files', file)
    })
    
    formData.append('folderStructure', JSON.stringify(chunkStructure))
    formData.append('conflictResolution', conflictResolution.value)
    
    try {
      // Upload this chunk
      const chunkResponse = await uploadChunkWithProgress(formData, chunkNumber, chunks.length)
      results.push(chunkResponse)
      
      totalUploaded += chunk.length
      uploadedFiles.value = totalUploaded
      
      // Update overall progress
      uploadProgress.value = Math.round((totalUploaded / files.length) * 100)
      
      // Small delay between chunks to prevent overwhelming the server
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (error) {
      currentFile.value = `Batch ${chunkNumber} failed: ${error.message}`
      throw new Error(`Upload failed at batch ${chunkNumber}: ${error.message}`)
    }
  }
  
  currentFile.value = 'Upload complete!'
  uploadProgress.value = 100
  
  // Combine results
  const totalSuccessful = results.reduce((sum, r) => sum + (r.uploaded || 0), 0)
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0)
  
  return {
    success: true,
    uploaded: totalSuccessful,
    failed: totalFailed,
    data: results
  }
}

const uploadChunkWithProgress = async (formData, chunkNumber, totalChunks) => {
  // Validate auth header exists
  if (!authHeader.value) {
    throw new Error('Authentication required. Please refresh the page and try again.')
  }
  
  // Make actual API call with timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout per chunk
  
  try {
    const response = await fetch('/api/admin/upload/batch', {
      method: 'POST',
      headers: {
        'Authorization': authHeader.value
      },
      body: formData,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Handle specific HTTP status codes
    if (!response.ok) {
      let errorMessage = 'Upload failed'
      
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication failed. Please refresh the page and try again.'
          break
        case 403:
          errorMessage = 'Permission denied. You do not have access to upload files.'
          break
        case 413:
          errorMessage = 'Upload too large. Try uploading fewer files or smaller files.'
          break
        case 429:
          errorMessage = 'Too many requests. Please wait a moment and try again.'
          break
        case 500:
          errorMessage = 'Server error. Please try again later.'
          break
        case 502:
        case 503:
        case 504:
          errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
          break
        default:
          errorMessage = `Upload failed with error ${response.status}: ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }
    
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      throw new Error('Invalid response from server. Upload may have failed.')
    }
    
    // Validate response structure
    if (!result) {
      throw new Error('Empty response from server. Upload status unknown.')
    }
    
    // Check for API-level errors
    if (result.success === false) {
      throw new Error(result.error || result.message || 'Upload failed on server')
    }
    
    return result
  } catch (error) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error('Chunk upload timed out. Please try with fewer files or check your connection.')
    }
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection and try again.')
    }
    
    throw error
  }
}

const uploadWithProgress = async (formData) => {
  // Set initial progress state
  uploadProgress.value = 0
  currentFile.value = 'Preparing upload...'
  
  try {
    // Validate auth header exists
    if (!authHeader.value) {
      throw new Error('Authentication required. Please refresh the page and try again.')
    }
    
    // Update progress to show upload starting
    uploadProgress.value = 10
    currentFile.value = 'Uploading files to server...'
    
    // Make actual API call with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout
    
    const response = await fetch('/api/admin/upload/batch', {
      method: 'POST',
      headers: {
        'Authorization': authHeader.value
      },
      body: formData,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Handle specific HTTP status codes
    if (!response.ok) {
      let errorMessage = 'Upload failed'
      
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication failed. Please refresh the page and try again.'
          break
        case 403:
          errorMessage = 'Permission denied. You do not have access to upload files.'
          break
        case 413:
          errorMessage = 'Upload too large. Try uploading fewer files or smaller files.'
          break
        case 429:
          errorMessage = 'Too many requests. Please wait a moment and try again.'
          break
        case 500:
          errorMessage = 'Server error. Please try again later.'
          break
        case 502:
        case 503:
        case 504:
          errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
          break
        default:
          errorMessage = `Upload failed with error ${response.status}: ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }
    
    // Update progress to show processing
    uploadProgress.value = 90
    currentFile.value = 'Processing files...'
    
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      throw new Error('Invalid response from server. Upload may have failed.')
    }
    
    // Validate response structure
    if (!result) {
      throw new Error('Empty response from server. Upload status unknown.')
    }
    
    // Check for API-level errors
    if (result.success === false) {
      throw new Error(result.error || result.message || 'Upload failed on server')
    }
    
    // Complete progress
    uploadProgress.value = 100
    uploadedFiles.value = selectedFiles.value.length
    currentFile.value = 'Upload complete!'
    
    return result
  } catch (error) {
    // Reset progress on error
    uploadProgress.value = 0
    currentFile.value = 'Upload failed'
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Please try with fewer files or check your connection.')
    }
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection and try again.')
    }
    
    throw error
  }
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
console.log('FolderUploadModal v2 loaded - Enhanced version')

// Watch for modal close
watch(visible, (newVal) => {
  if (!newVal) {
    resetModal()
  }
})
</script>

<style scoped>
/* Dialog customization */
.folder-upload-modal-v2 :deep(.p-dialog) {
  border-radius: 12px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15) !important;
  border: none !important;
}

.folder-upload-modal-v2 :deep(.p-dialog-header) {
  background-color: #fafbfc !important;
  border-bottom: 1px solid #e1e4e8 !important;
  padding: 1.5rem 2rem !important;
}

.folder-upload-modal-v2 :deep(.p-dialog-content) {
  padding: 2rem !important;
  background-color: #ffffff !important;
}

.folder-upload-modal-v2 :deep(.p-dialog-footer) {
  background-color: #fafbfc !important;
  border-top: 1px solid #e1e4e8 !important;
  padding: 1rem 2rem !important;
  gap: 0.75rem !important;
}

/* Drop zone animation */
.folder-drop-zone {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.folder-drop-zone:hover {
  border-color: var(--primary-300);
  background-color: var(--primary-50);
}

/* Animation for upload icon */
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
}

.p-animation-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

/* Responsive */
@media (max-width: 768px) {
  :deep(.p-dialog) {
    width: 95vw !important;
    margin: 0.5rem;
  }
  
  .folder-drop-zone {
    min-height: 150px;
  }
}
</style>