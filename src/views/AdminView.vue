<template>
  <div class="admin-container">
    <!-- Admin Header -->
    <div class="admin-header">
      <div class="header-left">
        <router-link to="/" class="back-link">
          <i class="pi pi-arrow-left"></i>
          Back to Browser
        </router-link>
        <h1>Admin Dashboard</h1>
      </div>
      <div class="header-right">
        <button @click="refreshStats" class="refresh-button">
          <i class="pi pi-refresh"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-images"></i>
        </div>
        <div class="stat-content">
          <h3>Total Images</h3>
          <p class="stat-value">{{ stats.totalFiles || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-folder"></i>
        </div>
        <div class="stat-content">
          <h3>Folders</h3>
          <p class="stat-value">{{ stats.folderCount || 0 }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-database"></i>
        </div>
        <div class="stat-content">
          <h3>Total Size</h3>
          <p class="stat-value">{{ stats.totalSizeMB || 0 }} MB</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <i class="pi pi-clock"></i>
        </div>
        <div class="stat-content">
          <h3>Last Updated</h3>
          <p class="stat-value">{{ formatDate(stats.lastUpdated) }}</p>
        </div>
      </div>
    </div>

    <!-- File Type Breakdown -->
    <div class="file-types-section">
      <h2>File Types</h2>
      <div class="file-types-grid">
        <div v-for="(count, type) in stats.fileTypes" :key="type" class="file-type-card">
          <div class="file-type-icon">
            <i :class="getFileTypeIcon(type)"></i>
          </div>
          <div class="file-type-info">
            <span class="file-type-ext">.{{ type }}</span>
            <span class="file-type-count">{{ count }} files</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin Actions -->
    <div class="admin-actions">
      <h2>Quick Actions</h2>
      <div class="actions-grid">
        <div class="action-card" @click="showUploadModal = true">
          <i class="pi pi-upload"></i>
          <h3>Upload Images</h3>
          <p>Add new images to your collections</p>
        </div>

        <div class="action-card" @click="showCreateFolderModal = true">
          <i class="pi pi-folder-plus"></i>
          <h3>Create Folder</h3>
          <p>Organize images in new folders</p>
        </div>

        <div class="action-card coming-soon">
          <i class="pi pi-trash"></i>
          <h3>Bulk Delete</h3>
          <p>Coming soon...</p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-overlay">
      <i class="pi pi-spin pi-spinner"></i>
      Loading statistics...
    </div>
  </div>
</template>

<script>
import { ref, onMounted, inject } from 'vue'

export default {
  name: 'AdminView',
  setup() {
    const authHeader = inject('authHeader')
    const stats = ref({})
    const loading = ref(false)
    const showUploadModal = ref(false)
    const showCreateFolderModal = ref(false)

    const loadStats = async () => {
      loading.value = true
      try {
        const response = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': authHeader.value
          }
        })
        
        const data = await response.json()
        if (data.success) {
          stats.value = data.stats
        }
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        loading.value = false
      }
    }

    const refreshStats = () => {
      loadStats()
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleString()
    }

    const getFileTypeIcon = (type) => {
      const iconMap = {
        'png': 'pi pi-image',
        'jpg': 'pi pi-image',
        'jpeg': 'pi pi-image',
        'gif': 'pi pi-image',
        'svg': 'pi pi-code',
        'webp': 'pi pi-image'
      }
      return iconMap[type] || 'pi pi-file'
    }

    onMounted(() => {
      loadStats()
    })

    return {
      stats,
      loading,
      showUploadModal,
      showCreateFolderModal,
      refreshStats,
      formatDate,
      getFileTypeIcon
    }
  }
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

/* Header */
.admin-header {
  background-color: #fff;
  padding: 20px 30px;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.back-link {
  color: #1976d2;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: color 0.2s;
}

.back-link:hover {
  color: #1565c0;
}

.refresh-button {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  transition: background-color 0.2s;
}

.refresh-button:hover {
  background-color: #1565c0;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  padding: 30px;
}

.stat-card {
  background-color: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  background-color: #e3f2fd;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1976d2;
  font-size: 24px;
}

.stat-content h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stat-value {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

/* File Types Section */
.file-types-section {
  padding: 0 30px 30px;
}

.file-types-section h2 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
}

.file-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.file-type-card {
  background-color: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 15px;
}

.file-type-icon {
  width: 40px;
  height: 40px;
  background-color: #f5f7fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.file-type-info {
  display: flex;
  flex-direction: column;
}

.file-type-ext {
  font-weight: 600;
  color: #333;
  text-transform: uppercase;
}

.file-type-count {
  font-size: 12px;
  color: #666;
}

/* Admin Actions */
.admin-actions {
  padding: 0 30px 30px;
}

.admin-actions h2 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #333;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.action-card {
  background-color: #fff;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.action-card:hover:not(.coming-soon) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.action-card.coming-soon {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-card i {
  font-size: 48px;
  color: #1976d2;
  margin-bottom: 15px;
}

.action-card h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #333;
}

.action-card p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  font-size: 16px;
  color: #666;
}

.loading-overlay i {
  font-size: 32px;
  color: #1976d2;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
    padding: 20px;
  }
  
  .admin-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .header-right {
    width: 100%;
  }
  
  .refresh-button {
    width: 100%;
    justify-content: center;
  }
}
</style>