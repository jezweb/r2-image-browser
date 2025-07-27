import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../setup.js'
import { createMockFile, createMockFormData } from '../setup.js'

// Import upload functions
const { handleBatchUpload, processUploadedFile } = await import('../../src/worker-functions.js')

describe('Upload API Functions', () => {
  beforeEach(() => {
    global.mockR2Bucket.clear()
  })

  describe('processUploadedFile', () => {
    it('should upload a file with correct metadata', async () => {
      const file = createMockFile('test-image.png', 2048, 'image/png')
      const targetPath = 'uploads/test-image.png'
      const conflictResolution = 'rename'
      
      const result = await processUploadedFile(
        global.mockEnv,
        file,
        targetPath,
        conflictResolution
      )
      
      expect(result.status).toBe('success')
      expect(result.finalPath).toBe(targetPath)
      expect(result.originalName).toBe('test-image.png')
      expect(result.size).toBe(2048)
      expect(result.url).toContain('test-image.png')
      
      // Check that file was stored in R2
      const storedFile = await global.mockR2Bucket.get(targetPath)
      expect(storedFile).toBeTruthy()
      expect(storedFile.metadata.originalName).toBe('test-image.png')
      expect(storedFile.metadata.contentType).toBe('image/png')
    })

    it('should handle file conflicts with rename strategy', async () => {
      // First, upload a file
      const file1 = createMockFile('duplicate.png', 1024)
      await processUploadedFile(global.mockEnv, file1, 'uploads/duplicate.png', 'rename')
      
      // Upload another file with same name
      const file2 = createMockFile('duplicate.png', 2048)
      const result = await processUploadedFile(
        global.mockEnv,
        file2,
        'uploads/duplicate.png',
        'rename'
      )
      
      expect(result.status).toBe('success')
      expect(result.finalPath).toMatch(/uploads\/duplicate-\d+\.png/)
      expect(result.note).toContain('renamed')
    })

    it('should handle file conflicts with skip strategy', async () => {
      // Upload original file
      const file1 = createMockFile('existing.png', 1024)
      await processUploadedFile(global.mockEnv, file1, 'uploads/existing.png', 'rename')
      
      // Try to upload duplicate with skip strategy
      const file2 = createMockFile('existing.png', 2048)
      const result = await processUploadedFile(
        global.mockEnv,
        file2,
        'uploads/existing.png',
        'skip'
      )
      
      expect(result.status).toBe('skipped')
      expect(result.note).toContain('already exists')
    })

    it('should handle file conflicts with overwrite strategy', async () => {
      // Upload original file
      const file1 = createMockFile('overwrite-me.png', 1024)
      await processUploadedFile(global.mockEnv, file1, 'uploads/overwrite-me.png', 'rename')
      
      // Overwrite with new file
      const file2 = createMockFile('overwrite-me.png', 2048)
      const result = await processUploadedFile(
        global.mockEnv,
        file2,
        'uploads/overwrite-me.png',
        'overwrite'
      )
      
      expect(result.status).toBe('success')
      expect(result.finalPath).toBe('uploads/overwrite-me.png')
      expect(result.note).toContain('overwritten')
      
      // Verify the file was actually overwritten
      const storedFile = await global.mockR2Bucket.get('uploads/overwrite-me.png')
      expect(storedFile.size).toBe(2048)
    })

    it('should reject invalid file types', async () => {
      const file = createMockFile('malicious.exe', 1024, 'application/x-executable')
      
      const result = await processUploadedFile(
        global.mockEnv,
        file,
        'uploads/malicious.exe',
        'rename'
      )
      
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid file type')
    })

    it('should reject files that are too large', async () => {
      const largeFile = createMockFile('huge.png', 20 * 1024 * 1024, 'image/png') // 20MB
      
      const result = await processUploadedFile(
        global.mockEnv,
        largeFile,
        'uploads/huge.png',
        'rename'
      )
      
      expect(result.status).toBe('failed')
      expect(result.error).toContain('File too large')
    })
  })

  describe('handleBatchUpload', () => {
    it('should handle batch upload with folder structure', async () => {
      const files = [
        createMockFile('cat1.jpg', 1024),
        createMockFile('cat2.jpg', 2048),
        createMockFile('dog1.jpg', 1536)
      ]
      
      const folderStructure = {
        'cat1.jpg': 'animals/cats/cat1.jpg',
        'cat2.jpg': 'animals/cats/cat2.jpg', 
        'dog1.jpg': 'animals/dogs/dog1.jpg'
      }
      
      const formData = createMockFormData(files, folderStructure)
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST',
        body: formData
      })
      
      // Mock request.formData()
      request.formData = () => Promise.resolve(formData)
      
      const corsHeaders = {}
      const response = await handleBatchUpload(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(3)
      expect(result.data.results.every(r => r.status === 'success')).toBe(true)
      
      // Verify folder structure was preserved
      const catResults = result.data.results.filter(r => r.finalPath.includes('cats'))
      const dogResults = result.data.results.filter(r => r.finalPath.includes('dogs'))
      
      expect(catResults).toHaveLength(2)
      expect(dogResults).toHaveLength(1)
    })

    it('should handle upload with target path prefix', async () => {
      const files = [createMockFile('image.png', 1024)]
      const folderStructure = { 'image.png': 'image.png' }
      
      const formData = createMockFormData(files, folderStructure)
      formData.set('targetPath', 'user-uploads/2024')
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST',
        body: formData
      })
      
      request.formData = () => Promise.resolve(formData)
      
      const corsHeaders = {}
      const response = await handleBatchUpload(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.results[0].finalPath).toBe('user-uploads/2024/image.png')
    })

    it('should handle mixed success and failure results', async () => {
      const files = [
        createMockFile('valid.png', 1024, 'image/png'),
        createMockFile('invalid.exe', 1024, 'application/x-executable'),
        createMockFile('valid2.jpg', 2048, 'image/jpeg')
      ]
      
      const folderStructure = {
        'valid.png': 'valid.png',
        'invalid.exe': 'invalid.exe',
        'valid2.jpg': 'valid2.jpg'
      }
      
      const formData = createMockFormData(files, folderStructure)
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST',
        body: formData
      })
      
      request.formData = () => Promise.resolve(formData)
      
      const corsHeaders = {}
      const response = await handleBatchUpload(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(3)
      
      const successCount = result.data.results.filter(r => r.status === 'success').length
      const failedCount = result.data.results.filter(r => r.status === 'failed').length
      
      expect(successCount).toBe(2)
      expect(failedCount).toBe(1)
    })

    it('should validate required fields', async () => {
      const formData = new Map()
      // No files provided
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST',
        body: formData
      })
      
      request.formData = () => Promise.resolve(formData)
      
      const corsHeaders = {}
      const response = await handleBatchUpload(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No files provided')
    })

    it('should sanitize file paths', async () => {
      const files = [createMockFile('../../evil.png', 1024)]
      const folderStructure = { '../../evil.png': '../../system/evil.png' }
      
      const formData = createMockFormData(files, folderStructure)
      formData.set('conflictResolution', 'rename')
      
      const request = new Request('http://localhost/api/admin/upload/batch', {
        method: 'POST',
        body: formData
      })
      
      request.formData = () => Promise.resolve(formData)
      
      const corsHeaders = {}
      const response = await handleBatchUpload(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      // Path should be sanitized to remove ../
      expect(result.data.results[0].finalPath).not.toContain('../')
    })
  })
})