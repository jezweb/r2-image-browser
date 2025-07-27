<template>
  <div class="layout-wrapper">
    <!-- Enhanced Folder Navigation -->
    <div class="navigation-section">
      <FolderNavigator 
        :initial-path="selectedFolder"
        @navigate="handleFolderNavigation"
        @file-selected="handleFileSelected"
        @upload-request="handleUploadRequest"
        @folder-action="handleFolderAction"
      />
    </div>

    <!-- Header with Admin/Logout controls -->
    <div class="top-header">
      <div class="header-left">
        <h1 class="app-title">R2 Image Browser</h1>
      </div>
      <div class="header-right">
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

    <!-- Toast for copy notification -->
    <div v-if="showToast" class="toast">
      <i class="pi pi-check-circle mr-2"></i>
      {{ toastMessage }}
    </div>
  </div>
</template>

<script>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import FolderNavigator from '../components/FolderNavigator.vue'

export default {
  name: 'BrowserView',
  components: {
    FolderNavigator
  },
  setup() {
    const router = useRouter()
    const authHeader = inject('authHeader')
    const folders = ref([])
    const images = ref([])
    const selectedFolder = ref('')
    const loading = ref(false)
    const showToast = ref(false)
    const toastMessage = ref('')
    const showNavigatorOnly = ref(false)

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

    // New event handlers for FolderNavigator
    const handleFolderNavigation = (folderPath) => {
      selectedFolder.value = folderPath
      loadImages(folderPath)
    }

    const handleFileSelected = (file) => {
      if (file.url) {
        copyImageUrl(file)
      }
    }

    const handleUploadRequest = (path) => {
      // Could open an upload modal or redirect to admin
      router.push('/admin')
    }

    const handleFolderAction = (action) => {
      // Handle folder actions like create, rename, move, delete
      console.log('Folder action:', action)
      // For now, just show a notification
      showNotification(`Folder action: ${action.action}`, 'info')
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
      showNavigatorOnly,
      selectFolder,
      copyImageUrl,
      formatSize,
      imageLoaded,
      imageError,
      goBack,
      logout,
      handleFolderNavigation,
      handleFileSelected,
      handleUploadRequest,
      handleFolderAction
    }
  }
}
</script>

<style scoped>
/* Enhanced layout with FolderNavigator */
.layout-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f7fa;
}

/* Top Header */
.top-header {
  background-color: #fff;
  padding: 15px 30px;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

/* Navigation Section */
.navigation-section {
  flex: 1;
  overflow: hidden;
  background-color: #fff;
  margin: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.app-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0;
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
  .top-header {
    padding: 10px 15px;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  
  .header-right {
    justify-content: center;
  }
  
  .navigation-section {
    margin: 5px;
  }
  
  .app-title {
    font-size: 20px;
    text-align: center;
  }
}

/* Utilities */
.mr-2 {
  margin-right: 0.5rem;
}
</style>