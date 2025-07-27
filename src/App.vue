<template>
  <div class="app-container">
    <!-- Login Form -->
    <LoginForm v-if="!isAuthenticated" @login-success="handleLoginSuccess" />
    
    <!-- Router View for authenticated content -->
    <router-view v-else />
    
    <!-- Toast notifications -->
    <Toast />
  </div>
</template>

<script>
import { ref, onMounted, provide } from 'vue'
import LoginForm from './components/LoginForm.vue'
import Toast from 'primevue/toast'

export default {
  name: 'App',
  components: {
    LoginForm,
    Toast
  },
  setup() {
    const isAuthenticated = ref(false)
    const authHeader = ref('')
    
    // Provide auth header to child components
    provide('authHeader', authHeader)
    
    const handleLoginSuccess = (auth) => {
      authHeader.value = auth
      isAuthenticated.value = true
    }

    onMounted(() => {
      // Check for existing auth on load
      const storedAuth = localStorage.getItem('auth')
      if (storedAuth) {
        authHeader.value = storedAuth
        isAuthenticated.value = true
      }
    })

    return {
      isAuthenticated,
      handleLoginSuccess
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background-color: #f5f7fa;
  color: #333;
}

.app-container {
  min-height: 100vh;
}

/* Global link styles */
a {
  color: inherit;
  text-decoration: none;
}

/* Utilities */
.mr-2 {
  margin-right: 0.5rem;
}
</style>