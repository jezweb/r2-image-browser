<template>
  <div class="folder-manager">
    <div class="manager-header">
      <h3>Folder Management</h3>
      <button @click="loadFolders" class="refresh-btn">
        <i class="pi pi-refresh"></i>
        Refresh
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <i class="pi pi-spin pi-spinner"></i>
      Loading folders...
    </div>

    <div v-else-if="foldersWithStats.length === 0" class="empty-state">
      <i class="pi pi-folder"></i>
      <p>No folders found</p>
      <p class="empty-subtitle">Create a folder to get started</p>
    </div>

    <div v-else class="folders-table">
      <div class="table-header">
        <div class="header-cell name">Folder Name</div>
        <div class="header-cell files">Files</div>
        <div class="header-cell size">Size</div>
        <div class="header-cell actions">Actions</div>
      </div>

      <div v-for="folder in foldersWithStats" :key="folder.name" class="table-row">
        <div class="cell name">
          <div v-if="editingFolder === folder.name" class="edit-name">
            <input
              v-model="editName"
              @keyup.enter="saveRename(folder.name)"
              @keyup.escape="cancelEdit"
              @blur="cancelEdit"
              class="edit-input"
              ref="editInput"
            >
          </div>
          <div v-else class="folder-info">
            <i class="pi pi-folder"></i>
            <span>{{ folder.name }}</span>
          </div>
        </div>

        <div class="cell files">
          <span class="file-count">{{ folder.fileCount }}</span>
        </div>

        <div class="cell size">
          <span class="folder-size">{{ formatSize(folder.totalSize) }}</span>
        </div>

        <div class="cell actions">
          <div class="action-buttons">
            <button
              @click="startRename(folder.name)"
              class="action-btn rename"
              title="Rename folder"
            >
              <i class="pi pi-pencil"></i>
            </button>
            <button
              @click="confirmDelete(folder)"
              class="action-btn delete"
              title="Delete folder"
            >
              <i class="pi pi-trash"></i>
            </button>
            <router-link
              :to="`/?folder=${encodeURIComponent(folder.name)}`"
              class="action-btn view"
              title="View in browser"
            >
              <i class="pi pi-eye"></i>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="deleteDialogVisible" class="modal-overlay" @click.self="cancelDelete">
      <div class="delete-dialog">
        <div class="dialog-header">
          <h3>Delete Folder</h3>
          <button @click="cancelDelete" class="close-btn">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <div class="warning-icon">
            <i class="pi pi-exclamation-triangle"></i>
          </div>
          <div class="warning-content">
            <p><strong>Are you sure you want to delete "{{ folderToDelete?.name }}"?</strong></p>
            <p>This will permanently delete {{ folderToDelete?.fileCount }} files.</p>
            <p class="warning-text">This action cannot be undone.</p>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="cancelDelete" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="executeDelete" :disabled="isDeleting" class="btn btn-danger">
            <i :class="isDeleting ? 'pi pi-spin pi-spinner' : 'pi pi-trash'"></i>
            {{ isDeleting ? 'Deleting...' : 'Delete Folder' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, nextTick } from 'vue';

const emit = defineEmits(['foldersChanged']);

const authHeader = inject('authHeader');
const folders = ref([]);
const foldersWithStats = ref([]);
const loading = ref(false);
const editingFolder = ref(null);
const editName = ref('');
const editInput = ref(null);

// Delete dialog state
const deleteDialogVisible = ref(false);
const folderToDelete = ref(null);
const isDeleting = ref(false);

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const loadFolders = async () => {
  loading.value = true;
  try {
    // Load folder list
    const foldersResponse = await fetch('/api/folders', {
      headers: {
        'Authorization': authHeader
      }
    });
    const foldersData = await foldersResponse.json();
    
    if (foldersData.success) {
      folders.value = foldersData.folders;
      
      // Get stats for each folder
      const folderStats = await Promise.all(
        folders.value.map(async (folder) => {
          try {
            const imagesResponse = await fetch(`/api/images?folder=${encodeURIComponent(folder.name)}`, {
              headers: {
                'Authorization': authHeader
              }
            });
            const imagesData = await imagesResponse.json();
            
            if (imagesData.success) {
              const fileCount = imagesData.images.length;
              const totalSize = imagesData.images.reduce((sum, img) => sum + (img.size || 0), 0);
              
              return {
                ...folder,
                fileCount,
                totalSize
              };
            }
            return { ...folder, fileCount: 0, totalSize: 0 };
          } catch {
            return { ...folder, fileCount: 0, totalSize: 0 };
          }
        })
      );
      
      foldersWithStats.value = folderStats;
    }
  } catch (error) {
    console.error('Error loading folders:', error);
  } finally {
    loading.value = false;
  }
};

const startRename = async (folderName) => {
  editingFolder.value = folderName;
  editName.value = folderName;
  await nextTick();
  editInput.value?.[0]?.focus();
};

const cancelEdit = () => {
  editingFolder.value = null;
  editName.value = '';
};

const saveRename = async (oldName) => {
  if (!editName.value.trim() || editName.value === oldName) {
    cancelEdit();
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/folders/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        name: editName.value.trim()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      await loadFolders();
      emit('foldersChanged');
    } else {
      alert('Error renaming folder: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  } finally {
    cancelEdit();
  }
};

const confirmDelete = (folder) => {
  folderToDelete.value = folder;
  deleteDialogVisible.value = true;
};

const cancelDelete = () => {
  deleteDialogVisible.value = false;
  folderToDelete.value = null;
};

const executeDelete = async () => {
  if (!folderToDelete.value) return;
  
  isDeleting.value = true;
  
  try {
    const response = await fetch(`/api/admin/folders/${encodeURIComponent(folderToDelete.value.name)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      await loadFolders();
      emit('foldersChanged');
    } else {
      alert('Error deleting folder: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  } finally {
    isDeleting.value = false;
    cancelDelete();
  }
};

onMounted(() => {
  loadFolders();
});

defineExpose({
  loadFolders
});
</script>

<style scoped>
.folder-manager {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.manager-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manager-header h3 {
  margin: 0;
  color: #333;
}

.refresh-btn {
  background: #6c757d;
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

.refresh-btn:hover {
  background: #5a6268;
}

.loading-state, .empty-state {
  padding: 3rem;
  text-align: center;
  color: #666;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #ccc;
}

.empty-subtitle {
  color: #999;
  font-size: 0.875rem;
}

.folders-table {
  display: flex;
  flex-direction: column;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e6ed;
  font-weight: 600;
  color: #333;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
}

.table-row:hover {
  background: #f8f9fa;
}

.header-cell.name,
.cell.name {
  min-width: 200px;
}

.header-cell.files,
.cell.files {
  width: 80px;
  text-align: center;
}

.header-cell.size,
.cell.size {
  width: 100px;
  text-align: right;
}

.header-cell.actions,
.cell.actions {
  width: 120px;
}

.folder-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.folder-info i {
  color: #007bff;
}

.edit-name {
  display: flex;
  align-items: center;
}

.edit-input {
  padding: 0.25rem 0.5rem;
  border: 2px solid #007bff;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 100%;
}

.file-count {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.folder-size {
  font-family: monospace;
  font-size: 0.875rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.375rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.action-btn.rename {
  background: #ffc107;
  color: #212529;
}

.action-btn.rename:hover {
  background: #e0a800;
}

.action-btn.delete {
  background: #dc3545;
  color: white;
}

.action-btn.delete:hover {
  background: #c82333;
}

.action-btn.view {
  background: #28a745;
  color: white;
}

.action-btn.view:hover {
  background: #218838;
}

/* Delete Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.delete-dialog {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  overflow: hidden;
}

.dialog-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #666;
  cursor: pointer;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #333;
}

.dialog-body {
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
}

.warning-icon {
  flex-shrink: 0;
}

.warning-icon i {
  font-size: 2rem;
  color: #ffc107;
}

.warning-content p {
  margin: 0 0 0.5rem 0;
}

.warning-text {
  color: #dc3545;
  font-weight: 500;
}

.dialog-actions {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e6ed;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

/* Responsive */
@media (max-width: 768px) {
  .table-header,
  .table-row {
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
  }
  
  .header-cell.files,
  .cell.files,
  .header-cell.size,
  .cell.size {
    display: none;
  }
  
  .action-buttons {
    flex-direction: column;
  }
}
</style>