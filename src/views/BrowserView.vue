<template>
  <div class="layout-wrapper">
    <!-- Sidebar -->
    <div class="sidebar">
      <h2 class="sidebar-title">
        <i class="pi pi-folder mr-2"></i>
        Collections
      </h2>
      <div class="folder-list">
        <div
          v-for="folder in folders"
          :key="folder.path"
          :class="['folder-item', { active: selectedFolder === folder.path }]"
          @click="selectFolder(folder.path)"
        >
          <i class="pi pi-folder mr-2"></i>
          {{ folder.name }}
        </div>
        <div v-if="folders.length === 0" class="no-folders">
          No folders found
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="header">
        <div class="header-left">
          <button v-if="selectedFolder" @click="goBack" class="back-button">
            <i class="pi pi-arrow-left mr-2"></i>
            Back to folders
          </button>
          <h1 class="app-title">R2 Image Browser</h1>
        </div>
        <div class="header-right">
          <div class="header-info">
          <span v-if="selectedFolder">
            {{ images.length }} images in {{ selectedFolder }}
          </span>
          <span v-else>
            Select a folder to view images
          </span>
          </div>
          <router-link to="/admin" class="admin-button">
            <i class="pi pi-cog"></i>
            Admin
          </router-link>
          <button @click="logout" class="logout-button">
            <i class="pi pi-sign-out"></i>
            Logout
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!selectedFolder && !loading" class="empty-state">
        <i class="pi pi-folder-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
        <h3>No folder selected</h3>
        <p>Select a folder from the sidebar to view its images</p>
      </div>

      <!-- Image Grid -->
      <div v-else class="image-grid">
        <div
          v-for="image in images"
          :key="image.key"
          class="image-card"
          @click="copyImageUrl(image)"
        >
          <div class="image-wrapper">
            <img
              :src="image.url"
              :alt="image.name"
              @load="imageLoaded"
              @error="imageError"
            />
          </div>
          <div class="image-info">
            <div class="image-name">{{ image.name }}</div>
            <div class="image-size">{{ formatSize(image.size) }}</div>
          </div>
          <div class="copy-overlay">
            <i class="pi pi-copy"></i>
            Click to copy URL
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading">
        <i class="pi pi-spin pi-spinner"></i>
        Loading...
      </div>

      <!-- Toast for copy notification -->
      <div v-if="showToast" class="toast">
        <i class="pi pi-check-circle mr-2"></i>
        {{ toastMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'BrowserView',
  setup() {
    const router = useRouter()
    const authHeader = inject('authHeader')
    const folders = ref([])
    const images = ref([])
    const selectedFolder = ref('')
    const loading = ref(false)
    const showToast = ref(false)
    const toastMessage = ref('')

    const loadFolders = async () => {
      try {
        const response = await fetch('/api/folders', {
          headers: {
            'Authorization': authHeader.value
          }
        })
        
        if (response.status === 401) {
          handleAuthError()
          return
        }
        
        const data = await response.json()
        if (data.success) {
          folders.value = data.folders
          images.value = []
        }
      } catch (error) {
        console.error('Error loading folders:', error)
        showNotification('Failed to load folders', 'error')
      }
    }

    const loadImages = async (folder) => {
      if (!folder) {
        images.value = []
        return
      }
      
      loading.value = true
      try {
        const url = `/api/images?folder=${encodeURIComponent(folder)}`
        const response = await fetch(url, {
          headers: {
            'Authorization': authHeader.value
          }
        })
        
        if (response.status === 401) {
          handleAuthError()
          return
        }
        
        const data = await response.json()
        if (data.success) {
          images.value = data.images
        }
      } catch (error) {
        console.error('Error loading images:', error)
        showNotification('Failed to load images', 'error')
      } finally {
        loading.value = false
      }
    }

    const selectFolder = (folder) => {
      selectedFolder.value = folder
      loadImages(folder)
    }
    
    const goBack = () => {
      selectedFolder.value = ''
      images.value = []
    }

    const copyImageUrl = async (image) => {
      const fullUrl = image.url
      try {
        await navigator.clipboard.writeText(fullUrl)
        showNotification('Image URL copied to clipboard!')
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = fullUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          showNotification('Image URL copied to clipboard!')
        } catch (err) {
          showNotification('Failed to copy URL', 'error')
        }
        document.body.removeChild(textArea)
      }
    }

    const showNotification = (message, type = 'success') => {
      toastMessage.value = message
      showToast.value = true
      setTimeout(() => {
        showToast.value = false
      }, 3000)
    }

    const formatSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const imageLoaded = (event) => {
      event.target.classList.add('loaded')
    }

    const imageError = (event) => {
      event.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999"%3EError%3C/text%3E%3C/svg%3E'
    }
    
    const handleAuthError = () => {
      router.push('/')
    }
    
    const logout = () => {
      localStorage.removeItem('auth')
      router.push('/')
      window.location.reload()
    }

    onMounted(() => {
      loadFolders()
    })

    return {
      folders,
      images,
      selectedFolder,
      loading,
      showToast,
      toastMessage,
      selectFolder,
      copyImageUrl,
      formatSize,
      imageLoaded,
      imageError,
      goBack,
      logout
    }
  }
}
</script>

<style scoped>
/* Import styles from App.vue - keeping them consistent */
.layout-wrapper {
  display: flex;
  height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background-color: #fff;
  border-right: 1px solid #e0e6ed;
  overflow-y: auto;
}

.sidebar-title {
  padding: 20px;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  align-items: center;
}

.folder-list {
  padding: 10px;
}

.folder-item {
  padding: 12px 15px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.folder-item:hover {
  background-color: #f5f7fa;
}

.folder-item.active {
  background-color: #e3f2fd;
  color: #1976d2;
}

.no-folders {
  padding: 20px;
  text-align: center;
  color: #666;
}

/* Main Content */
.main-content {
  flex: 1;
  overflow-y: auto;
  background-color: #f5f7fa;
}

.header {
  background-color: #fff;
  padding: 20px 30px;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.back-button {
  background-color: #f5f7fa;
  border: 1px solid #e0e6ed;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.back-button:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

.admin-button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: all 0.2s;
}

.admin-button:hover {
  background-color: #45a049;
}

.app-title {
  font-size: 24px;
  font-weight: 600;
}

.header-info {
  color: #666;
  font-size: 14px;
}

.logout-button {
  background-color: #f5f7fa;
  border: 1px solid #e0e6ed;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.logout-button:hover {
  background-color: #ffebee;
  border-color: #ef5350;
  color: #c62828;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #666;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  font-size: 20px;
  font-weight: 500;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  color: #999;
}

/* Image Grid */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  padding: 30px;
}

.image-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.image-card:hover .copy-overlay {
  opacity: 1;
}

.image-wrapper {
  width: 100%;
  height: 200px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.image-wrapper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-wrapper img.loaded {
  opacity: 1;
}

.image-info {
  padding: 15px;
}

.image-name {
  font-weight: 500;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-size {
  font-size: 12px;
  color: #666;
}

.copy-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  font-size: 14px;
}

.copy-overlay i {
  font-size: 24px;
  margin-bottom: 10px;
}

/* Loading */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50px;
  font-size: 16px;
  color: #666;
}

.loading i {
  margin-right: 10px;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #4caf50;
  color: white;
  padding: 15px 25px;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translate(-50%, 100%);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
    padding: 20px;
  }
}

/* Utilities */
.mr-2 {
  margin-right: 0.5rem;
}
</style>