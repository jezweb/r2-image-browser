<template>
  <div class="folder-manager">
    <div class="manager-header">
      <div class="header-content">
        <i class="pi pi-folder" style="font-size: 1.5rem; color: var(--primary-color);"></i>
        <span class="folders-count">{{ foldersWithStats.length }} folders</span>
      </div>
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
            <button
              @click="startMove(folder)"
              class="action-btn move"
              title="Move folder"
            >
              <i class="pi pi-folder-open"></i>
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

    <!-- Move Folder Dialog -->
    <div v-if="moveDialogVisible" class="modal-overlay" @click.self="cancelMove">
      <div class="move-dialog">
        <div class="dialog-header">
          <h3>Move Folder</h3>
          <button @click="cancelMove" class="close-btn">
            <i class="pi pi-times"></i>
          </button>
        </div>
        <div class="dialog-body">
          <p><strong>Moving: {{ folderToMove?.name }}</strong></p>
          <div class="move-options">
            <label>Move to:</label>
            <div class="radio-group">
              <div class="radio-option">
                <input
                  type="radio"
                  id="move-root"
                  value=""
                  v-model="moveTargetPath"
                  name="moveTarget"
                >
                <label for="move-root">
                  <i class="pi pi-home"></i>
                  Root (Top Level)
                </label>
              </div>
              <div v-for="folder in availableTargets" :key="folder.name" class="radio-option">
                <input
                  type="radio"
                  :id="`move-${folder.name}`"
                  :value="folder.name"
                  v-model="moveTargetPath"
                  name="moveTarget"
                >
                <label :for="`move-${folder.name}`">
                  <i class="pi pi-folder"></i>
                  {{ folder.name }}
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="cancelMove" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="executeMove" :disabled="isMoving" class="btn btn-primary">
            <i :class="isMoving ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'"></i>
            {{ isMoving ? 'Moving...' : 'Move Folder' }}
          </button>
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
import { formatSize } from '../utils.js';

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

// Move dialog state
const moveDialogVisible = ref(false);
const folderToMove = ref(null);
const moveTargetPath = ref('');
const isMoving = ref(false);
const availableTargets = ref([]);

// formatSize is now imported from utils.js

const loadFolders = async () => {
  loading.value = true;
  try {
    // Load folder list
    const foldersResponse = await fetch('/api/folders?limit=1000', {
      headers: {
        'Authorization': authHeader.value
      }
    });
    const foldersData = await foldersResponse.json();
    
    if (foldersData.success && foldersData.data) {
      folders.value = foldersData.data.folders || [];
      
      // Get stats for each folder
      const folderStats = await Promise.all(
        folders.value.map(async (folder) => {
          try {
            const imagesResponse = await fetch(`/api/images?folder=${encodeURIComponent(folder.name)}`, {
              headers: {
                'Authorization': authHeader.value
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
        'Authorization': authHeader.value
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
        'Authorization': authHeader.value
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

const startMove = (folder) => {
  folderToMove.value = folder;
  moveTargetPath.value = '';
  // Get available targets (all folders except the one being moved and its children)
  availableTargets.value = folders.value.filter(f => 
    f.name !== folder.name && !f.name.startsWith(folder.name + '/')
  );
  moveDialogVisible.value = true;
};

const cancelMove = () => {
  moveDialogVisible.value = false;
  folderToMove.value = null;
  moveTargetPath.value = '';
};

const executeMove = async () => {
  if (!folderToMove.value) return;
  
  isMoving.value = true;
  
  try {
    const response = await fetch('/api/admin/folders/move', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader.value
      },
      body: JSON.stringify({
        source: folderToMove.value.name,
        target: moveTargetPath.value
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      await loadFolders();
      emit('foldersChanged');
    } else {
      alert('Error moving folder: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Network error: ' + error.message);
  } finally {
    isMoving.value = false;
    cancelMove();
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
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e0e6ed;
}

.manager-header {
  padding: 2rem;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.folders-count {
  font-size: 1.25rem;
  font-weight: 600;
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
  grid-template-columns: 1fr 100px 120px 140px;
  gap: 1rem;
  padding: 1.25rem 2rem;
  background: linear-gradient(to bottom, #f8f9fa, #f0f1f3);
  border-bottom: 2px solid #e0e6ed;
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 100px 120px 140px;
  gap: 1rem;
  padding: 1.25rem 2rem;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
  transition: all 0.2s ease;
}

.table-row:hover {
  background: #f8f9fa;
  transform: translateX(4px);
  box-shadow: inset 4px 0 0 #007bff;
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

.action-btn.move {
  background: #17a2b8;
  color: white;
}

.action-btn.move:hover {
  background: #138496;
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

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0069d9;
}

/* Move Dialog */
.move-dialog {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  overflow: hidden;
}

.move-options {
  margin-top: 1rem;
}

.move-options label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: #333;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e0e6ed;
  border-radius: 4px;
  background: #f8f9fa;
}

.radio-option {
  display: flex;
  align-items: center;
}

.radio-option input[type="radio"] {
  margin-right: 0.5rem;
}

.radio-option label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem;
  cursor: pointer;
  font-weight: normal;
  flex: 1;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.radio-option label:hover {
  background: #e9ecef;
}

.radio-option input[type="radio"]:checked + label {
  background: #007bff20;
  color: #007bff;
  font-weight: 500;
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