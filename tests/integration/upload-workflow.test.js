import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import '../setup.js'

// Integration tests for the complete upload workflow
describe('Upload Workflow Integration', () => {
  let mockEnv

  beforeEach(() => {
    global.mockR2Bucket.clear()
    mockEnv = global.mockEnv
    
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  describe('Hierarchical Folder Upload Flow', () => {
    it('should complete full folder structure upload workflow', async () => {
      // 1. Simulate folder selection with nested structure
      const folderStructure = {
        'cat1.jpg': 'animals/cats/cat1.jpg',
        'cat2.jpg': 'animals/cats/cat2.jpg',
        'dog1.jpg': 'animals/dogs/dog1.jpg',
        'bird1.jpg': 'animals/birds/bird1.jpg'
      }
      
      const files = Object.keys(folderStructure).map(name => ({
        name,
        size: 1024 + Math.random() * 1000,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }))
      
      // 2. Process upload through batch handler
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', JSON.stringify(folderStructure))
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST'
      })
      request.formData = () => Promise.resolve(formData)
      
      const response = await handleBatchUpload(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      // 3. Verify upload results
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(4)
      expect(result.data.results.every(r => r.status === 'success')).toBe(true)
      
      // 4. Verify folder structure was created in R2
      const animalsCatsFiles = await mockEnv.R2_BUCKET.list({ prefix: 'animals/cats/' })
      const animalsDogsFiles = await mockEnv.R2_BUCKET.list({ prefix: 'animals/dogs/' })
      const animalsBirdsFiles = await mockEnv.R2_BUCKET.list({ prefix: 'animals/birds/' })
      
      expect(animalsCatsFiles.objects).toHaveLength(2)
      expect(animalsDogsFiles.objects).toHaveLength(1)
      expect(animalsBirdsFiles.objects).toHaveLength(1)
      
      // 5. Verify folder listing API can retrieve the structure
      const { handleListFolders } = await import('../../src/worker-functions.js')
      
      const listRequest = new Request('http://localhost/api/folders?depth=3')
      const listResponse = await handleListFolders(mockEnv, {}, listRequest)
      const listResult = JSON.parse(listResponse.body)
      
      expect(listResult.success).toBe(true)
      expect(listResult.data.folders).toHaveLength(1) // animals
      expect(listResult.data.folders[0].name).toBe('animals')
      expect(listResult.data.folders[0].children).toHaveLength(3) // cats, dogs, birds
    })

    it('should handle mixed upload results correctly', async () => {
      const folderStructure = {
        'valid1.jpg': 'uploads/valid1.jpg',
        'invalid.exe': 'uploads/invalid.exe', // Invalid type
        'valid2.png': 'uploads/valid2.png',
        'toolarge.jpg': 'uploads/toolarge.jpg' // Will be too large
      }
      
      const files = [
        { name: 'valid1.jpg', size: 1024, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
        { name: 'invalid.exe', size: 1024, type: 'application/x-executable', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
        { name: 'valid2.png', size: 2048, type: 'image/png', arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)) },
        { name: 'toolarge.jpg', size: 15 * 1024 * 1024, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(new ArrayBuffer(15 * 1024 * 1024)) }
      ]
      
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', JSON.stringify(folderStructure))
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST'
      })
      request.formData = () => Promise.resolve(formData)
      
      const response = await handleBatchUpload(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(4)
      
      const successCount = result.data.results.filter(r => r.status === 'success').length
      const failedCount = result.data.results.filter(r => r.status === 'failed').length
      
      expect(successCount).toBe(2) // valid1.jpg and valid2.png
      expect(failedCount).toBe(2) // invalid.exe and toolarge.jpg
      
      // Verify only valid files were stored
      const uploadsFiles = await mockEnv.R2_BUCKET.list({ prefix: 'uploads/' })
      expect(uploadsFiles.objects).toHaveLength(2)
    })

    it('should handle file conflicts with different strategies', async () => {
      // First upload
      await mockEnv.R2_BUCKET.put('conflicts/existing.jpg', 'original-content', {
        metadata: { originalName: 'existing.jpg' }
      })
      
      const folderStructure = {
        'existing.jpg': 'conflicts/existing.jpg',
        'new.jpg': 'conflicts/new.jpg'
      }
      
      const files = [
        { name: 'existing.jpg', size: 1024, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
        { name: 'new.jpg', size: 2048, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)) }
      ]
      
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      // Test rename strategy
      const formDataRename = new Map()
      formDataRename.set('files', files)
      formDataRename.set('folderStructure', JSON.stringify(folderStructure))
      formDataRename.set('conflictResolution', 'rename')
      
      const requestRename = new Request('http://localhost/api/admin/upload/batch', { method: 'POST' })
      requestRename.formData = () => Promise.resolve(formDataRename)
      
      const responseRename = await handleBatchUpload(mockEnv, {}, requestRename)
      const resultRename = JSON.parse(responseRename.body)
      
      expect(resultRename.success).toBe(true)
      const existingResult = resultRename.data.results.find(r => r.originalName === 'existing.jpg')
      expect(existingResult.status).toBe('success')
      expect(existingResult.finalPath).toMatch(/conflicts\/existing-\d+\.jpg/)
      expect(existingResult.note).toContain('renamed')
      
      // Test skip strategy
      const formDataSkip = new Map()
      formDataSkip.set('files', files)
      formDataSkip.set('folderStructure', JSON.stringify(folderStructure))
      formDataSkip.set('conflictResolution', 'skip')
      
      const requestSkip = new Request('http://localhost/api/admin/upload/batch', { method: 'POST' })
      requestSkip.formData = () => Promise.resolve(formDataSkip)
      
      const responseSkip = await handleBatchUpload(mockEnv, {}, requestSkip)
      const resultSkip = JSON.parse(responseSkip.body)
      
      const skippedResult = resultSkip.data.results.find(r => r.originalName === 'existing.jpg')
      expect(skippedResult.status).toBe('skipped')
    })
  })

  describe('Folder Navigation Integration', () => {
    beforeEach(async () => {
      // Set up complex folder structure
      const testFiles = {
        'projects/web/frontend/src/main.js': 'js-content',
        'projects/web/frontend/src/components/App.vue': 'vue-content',
        'projects/web/backend/server.js': 'server-content',
        'projects/mobile/ios/app.swift': 'swift-content',
        'projects/mobile/android/MainActivity.java': 'java-content',
        'assets/images/logo.png': 'png-content',
        'assets/images/icons/home.svg': 'svg-content',
        'docs/readme.md': 'md-content'
      }
      
      mockEnv.R2_BUCKET.seed(testFiles)
    })

    it('should navigate through folder hierarchy correctly', async () => {
      const { handleListFolders } = await import('../../src/worker-functions.js')
      
      // 1. List root folders
      const rootRequest = new Request('http://localhost/api/folders')
      const rootResponse = await handleListFolders(mockEnv, {}, rootRequest)
      const rootResult = JSON.parse(rootResponse.body)
      
      expect(rootResult.success).toBe(true)
      expect(rootResult.data.folders).toHaveLength(3) // projects, assets, docs
      expect(rootResult.data.folders.map(f => f.name)).toContain('projects')
      expect(rootResult.data.folders.map(f => f.name)).toContain('assets')
      expect(rootResult.data.folders.map(f => f.name)).toContain('docs')
      
      // 2. Navigate to projects folder
      const projectsRequest = new Request('http://localhost/api/folders?path=projects')
      const projectsResponse = await handleListFolders(mockEnv, {}, projectsRequest)
      const projectsResult = JSON.parse(projectsResponse.body)
      
      expect(projectsResult.data.folders).toHaveLength(2) // web, mobile
      
      // 3. Navigate to projects/web with depth 2
      const webRequest = new Request('http://localhost/api/folders?path=projects/web&depth=2')
      const webResponse = await handleListFolders(mockEnv, {}, webRequest)
      const webResult = JSON.parse(webResponse.body)
      
      expect(webResult.data.folders).toHaveLength(2) // frontend, backend
      expect(webResult.data.folders[0].children).toBeDefined() // Should have children due to depth=2
      
      // 4. Navigate to leaf folder with files
      const srcRequest = new Request('http://localhost/api/folders?path=projects/web/frontend/src&include_files=true')
      const srcResponse = await handleListFolders(mockEnv, {}, srcRequest)
      const srcResult = JSON.parse(srcResponse.body)
      
      expect(srcResult.data.files).toHaveLength(2) // main.js, App.vue
      expect(srcResult.data.files.map(f => f.name)).toContain('main.js')
      expect(srcResult.data.files.map(f => f.name)).toContain('App.vue')
    })

    it('should handle pagination in large folder structures', async () => {
      // Create many folders for pagination testing
      const manyFiles = {}
      for (let i = 1; i <= 50; i++) {
        manyFiles[`large-folder/item-${i.toString().padStart(3, '0')}.jpg`] = `content-${i}`
      }
      mockEnv.R2_BUCKET.seed(manyFiles)
      
      const { handleListFolders } = await import('../../src/worker-functions.js')
      
      // Request with limit
      const request = new Request('http://localhost/api/folders?path=large-folder&include_files=true&limit=20')
      const response = await handleListFolders(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.files).toHaveLength(20)
      expect(result.data.pagination.hasMore).toBe(true)
      expect(result.data.pagination.cursor).toBeDefined()
      
      // Request next page
      const nextRequest = new Request(`http://localhost/api/folders?path=large-folder&include_files=true&limit=20&cursor=${result.data.pagination.cursor}`)
      const nextResponse = await handleListFolders(mockEnv, {}, nextRequest)
      const nextResult = JSON.parse(nextResponse.body)
      
      expect(nextResult.data.files).toHaveLength(20)
      expect(nextResult.data.pagination.hasMore).toBe(true)
      
      // Verify different files
      const firstPageFiles = result.data.files.map(f => f.name)
      const secondPageFiles = nextResult.data.files.map(f => f.name)
      const overlap = firstPageFiles.filter(name => secondPageFiles.includes(name))
      expect(overlap).toHaveLength(0) // No overlap between pages
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle R2 service errors gracefully', async () => {
      // Mock R2 bucket to throw errors
      const originalPut = mockEnv.R2_BUCKET.put
      mockEnv.R2_BUCKET.put = vi.fn().mockRejectedValue(new Error('R2 service unavailable'))
      
      const { processUploadedFile } = await import('../../src/worker-functions.js')
      
      const file = {
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }
      
      const result = await processUploadedFile(mockEnv, file, 'test.jpg', 'rename')
      
      expect(result.status).toBe('failed')
      expect(result.error).toContain('R2 service unavailable')
      
      // Restore original function
      mockEnv.R2_BUCKET.put = originalPut
    })

    it('should handle malformed folder structure data', async () => {
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      const files = [
        { name: 'test.jpg', size: 1024, type: 'image/jpeg', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) }
      ]
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', 'invalid-json') // Malformed JSON
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', { method: 'POST' })
      request.formData = () => Promise.resolve(formData)
      
      const response = await handleBatchUpload(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid folder structure')
    })

    it('should handle empty uploads gracefully', async () => {
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      const formData = new Map()
      // No files provided
      
      const request = new Request('http://localhost/api/admin/upload/batch', { method: 'POST' })
      request.formData = () => Promise.resolve(formData)
      
      const response = await handleBatchUpload(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No files provided')
    })

    it('should validate path security in folder operations', async () => {
      const { handleListFolders } = await import('../../src/worker-functions.js')
      
      // Attempt path traversal
      const maliciousRequest = new Request('http://localhost/api/folders?path=../../../etc/passwd')
      const response = await handleListFolders(mockEnv, {}, maliciousRequest)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal not allowed')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large batch uploads efficiently', async () => {
      const { handleBatchUpload } = await import('../../src/worker-functions.js')
      
      // Create 100 files
      const files = Array.from({ length: 100 }, (_, i) => ({
        name: `file-${i}.jpg`,
        size: 1024,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }))
      
      const folderStructure = {}
      files.forEach((file, i) => {
        const folder = Math.floor(i / 10) // 10 files per folder
        folderStructure[file.name] = `batch-${folder}/${file.name}`
      })
      
      const startTime = Date.now()
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', JSON.stringify(folderStructure))
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', { method: 'POST' })
      request.formData = () => Promise.resolve(formData)
      
      const response = await handleBatchUpload(mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(100)
      expect(result.data.results.every(r => r.status === 'success')).toBe(true)
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000) // 5 seconds
      
      // Verify all files were stored correctly
      for (let i = 0; i < 10; i++) {
        const folderFiles = await mockEnv.R2_BUCKET.list({ prefix: `batch-${i}/` })
        expect(folderFiles.objects).toHaveLength(10)
      }
    })
  })
})