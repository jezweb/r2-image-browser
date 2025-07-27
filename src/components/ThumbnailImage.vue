<template>
  <div class="thumbnail-image-container">
    <!-- Loading placeholder -->
    <div v-if="isLoading" class="thumbnail-loading">
      <i class="pi pi-spin pi-spinner"></i>
    </div>
    
    <!-- Error state -->
    <div v-else-if="hasError" class="thumbnail-error">
      <i class="pi pi-exclamation-triangle"></i>
    </div>
    
    <!-- Actual image -->
    <img 
      v-else
      ref="imageRef"
      :src="src"
      :alt="alt"
      class="thumbnail-image"
      @load="onLoad"
      @error="onError"
      loading="lazy"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  lazyLoad: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['load', 'error']);

// Reactive state
const imageRef = ref(null);
const isLoading = ref(true);
const hasError = ref(false);
const isIntersecting = ref(false);

// Intersection Observer for lazy loading
let observer = null;

// Methods
const onLoad = () => {
  isLoading.value = false;
  hasError.value = false;
  emit('load', props.src);
};

const onError = () => {
  isLoading.value = false;
  hasError.value = true;
  emit('error', props.src);
};

const setupIntersectionObserver = () => {
  if (!props.lazyLoad) {
    isIntersecting.value = true;
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isIntersecting.value = true;
          observer?.disconnect();
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '50px'
    }
  );

  if (imageRef.value) {
    observer.observe(imageRef.value);
  }
};

// Lifecycle
onMounted(() => {
  if (props.lazyLoad) {
    setupIntersectionObserver();
  } else {
    isIntersecting.value = true;
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style scoped>
.thumbnail-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s ease;
}

.thumbnail-loading,
.thumbnail-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #6c757d;
  font-size: 0.75rem;
}

.thumbnail-loading {
  background: linear-gradient(90deg, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.thumbnail-error {
  background: #fff5f5;
  color: #dc3545;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Hover effects */
.thumbnail-image-container:hover .thumbnail-image {
  opacity: 0.9;
  transform: scale(1.02);
  transition: all 0.2s ease;
}
</style>