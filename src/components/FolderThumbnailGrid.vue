<template>
  <div class="folder-thumbnail-grid" :class="`size-${size}`">
    <!-- Preview Images -->
    <div 
      v-for="(image, index) in displayImages" 
      :key="index"
      class="thumbnail-slot"
    >
      <ThumbnailImage 
        :src="image.url"
        :alt="image.name"
        :loading="loading"
        @load="onImageLoad"
        @error="onImageError"
      />
    </div>
    
    <!-- Empty slots for folders with fewer than 4 images -->
    <div 
      v-for="index in emptySlots" 
      :key="`empty-${index}`"
      class="thumbnail-slot empty"
    >
      <div class="empty-placeholder">
        <i class="pi pi-image"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ThumbnailImage from './ThumbnailImage.vue';

const props = defineProps({
  previewImages: {
    type: Array,
    default: () => []
  },
  folderName: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'medium', // small, medium, large
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  maxImages: {
    type: Number,
    default: 4
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['imageLoad', 'imageError']);

const loadedImages = ref(new Set());
const errorImages = ref(new Set());

// Computed properties
const displayImages = computed(() => {
  return props.previewImages.slice(0, props.maxImages);
});

const emptySlots = computed(() => {
  const usedSlots = displayImages.value.length;
  const totalSlots = props.maxImages;
  return Math.max(0, totalSlots - usedSlots);
});

// Event handlers
const onImageLoad = (imageSrc) => {
  loadedImages.value.add(imageSrc);
  emit('imageLoad', imageSrc);
};

const onImageError = (imageSrc) => {
  errorImages.value.add(imageSrc);
  emit('imageError', imageSrc);
};
</script>

<style scoped>
.folder-thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

/* Size variants */
.folder-thumbnail-grid.size-small {
  width: 80px;
  height: 80px;
  gap: 1px;
  border-radius: 6px;
}

.folder-thumbnail-grid.size-medium {
  width: 120px;
  height: 120px;
  gap: 2px;
  border-radius: 8px;
}

.folder-thumbnail-grid.size-large {
  width: 160px;
  height: 160px;
  gap: 3px;
  border-radius: 10px;
}

.thumbnail-slot {
  position: relative;
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-slot.empty {
  background: #e9ecef;
  border: 1px dashed #ced4da;
}

.empty-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #adb5bd;
  font-size: 0.75rem;
}

.size-small .empty-placeholder {
  font-size: 0.625rem;
}

.size-large .empty-placeholder {
  font-size: 1rem;
}

/* Hover effects */
.folder-thumbnail-grid:hover {
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.folder-thumbnail-grid:hover .thumbnail-slot.empty {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

/* Loading state */
.folder-thumbnail-grid.loading .thumbnail-slot {
  background: linear-gradient(90deg, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .folder-thumbnail-grid.size-medium {
    width: 100px;
    height: 100px;
  }
  
  .folder-thumbnail-grid.size-large {
    width: 120px;
    height: 120px;
  }
}
</style>