<template>
  <div class="create-folder-modal">
    <form @submit.prevent="createFolder">
      <div class="form-group">
        <label for="folderName">Folder Name</label>
        <input
          id="folderName"
          v-model="folderName"
          type="text"
          :class="['form-input', { error: error }]"
          placeholder="Enter folder name"
          maxlength="50"
          @input="validateName"
          ref="nameInput"
        >
        <div v-if="error" class="error-message">{{ error }}</div>
        <div class="help-text">
          Only letters, numbers, hyphens, and underscores are allowed
        </div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          @click="$emit('cancel')"
          class="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="!isValid || isCreating"
          class="btn btn-primary"
        >
          <i :class="isCreating ? 'pi pi-spin pi-spinner' : 'pi pi-plus'"></i>
          {{ isCreating ? 'Creating...' : 'Create Folder' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';

const props = defineProps({
  existingFolders: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['created', 'cancel']);

const authHeader = inject('authHeader');
const folderName = ref('');
const error = ref('');
const isCreating = ref(false);
const nameInput = ref(null);

const isValid = computed(() => {
  return folderName.value.trim() && !error.value;
});

const validateName = () => {
  const name = folderName.value.trim();
  error.value = '';
  
  if (!name) {
    return;
  }
  
  // Check format
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    error.value = 'Only letters, numbers, hyphens, and underscores are allowed';
    return;
  }
  
  // Check if already exists
  if (props.existingFolders.some(folder => folder.name.toLowerCase() === name.toLowerCase())) {
    error.value = 'A folder with this name already exists';
    return;
  }
  
  // Check length
  if (name.length > 50) {
    error.value = 'Folder name must be 50 characters or less';
    return;
  }
};

const createFolder = async () => {
  if (!isValid.value || isCreating.value) return;
  
  isCreating.value = true;
  error.value = '';
  
  try {
    const response = await fetch('/api/admin/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        name: folderName.value.trim()
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      emit('created', result.folder);
      folderName.value = '';
    } else {
      error.value = result.error || 'Failed to create folder';
    }
  } catch (err) {
    error.value = 'Network error: ' + err.message;
  } finally {
    isCreating.value = false;
  }
};

onMounted(() => {
  // Focus the input when modal opens
  nameInput.value?.focus();
});
</script>

<style scoped>
.create-folder-modal {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
}

.form-input.error {
  border-color: #dc3545;
}

.error-message {
  margin-top: 0.5rem;
  color: #dc3545;
  font-size: 0.875rem;
}

.help-text {
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}
</style>