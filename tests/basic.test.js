import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'

// Basic functionality tests to ensure core logic works
describe('Core Functionality Tests', () => {
  beforeEach(() => {
    global.mockR2Bucket.clear()
  })

  describe('Path Validation', () => {
    it('should validate safe paths', async () => {
      const { validateAndSanitizePath } = await import('../src/worker-functions.js')
      
      expect(() => validateAndSanitizePath('folder/subfolder')).not.toThrow()
      expect(() => validateAndSanitizePath('images/2024')).not.toThrow()
      expect(() => validateAndSanitizePath('')).not.toThrow()
    })

    it('should reject dangerous paths', async () => {
      const { validateAndSanitizePath } = await import('../src/worker-functions.js')
      
      expect(() => validateAndSanitizePath('../secrets')).toThrow('Path traversal not allowed')
      expect(() => validateAndSanitizePath('folder//subfolder')).toThrow('Double slashes not allowed')
    })
  })

  describe('File Upload Processing', () => {
    it('should process valid file upload', async () => {
      const { processUploadedFile } = await import('../src/worker-functions.js')
      
      const file = {
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }
      
      const result = await processUploadedFile(global.mockEnv, file, 'uploads/test.jpg', 'rename')
      
      expect(result.status).toBe('success')
      expect(result.originalName).toBe('test.jpg')
      expect(result.finalPath).toBe('uploads/test.jpg')
      expect(result.size).toBe(1024)
    })

    it('should reject invalid file types', async () => {
      const { processUploadedFile } = await import('../src/worker-functions.js')
      
      const file = {
        name: 'malicious.exe',
        size: 1024,
        type: 'application/x-executable',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }
      
      const result = await processUploadedFile(global.mockEnv, file, 'uploads/malicious.exe', 'rename')
      
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid file type')
    })

    it('should handle file conflicts with rename', async () => {
      const { processUploadedFile } = await import('../src/worker-functions.js')
      
      // Upload first file
      const file1 = {
        name: 'duplicate.jpg',
        size: 1024,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      }
      
      await processUploadedFile(global.mockEnv, file1, 'uploads/duplicate.jpg', 'rename')
      
      // Upload duplicate
      const file2 = {
        name: 'duplicate.jpg',
        size: 2048,
        type: 'image/jpeg',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
      }
      
      const result = await processUploadedFile(global.mockEnv, file2, 'uploads/duplicate.jpg', 'rename')
      
      expect(result.status).toBe('success')
      expect(result.finalPath).toMatch(/uploads\/duplicate-\d+\.jpg/)
      expect(result.note).toContain('renamed')
    })
  })

  describe('Folder Hierarchy Building', () => {
    it('should build correct folder structure', async () => {
      const { buildFolderHierarchy } = await import('../src/worker-functions.js')
      
      const files = [
        { key: 'images/cats/persian.jpg' },
        { key: 'images/cats/siamese.jpg' },
        { key: 'images/dogs/golden.jpg' },
        { key: 'docs/readme.txt' }
      ]

      const hierarchy = buildFolderHierarchy(files)
      
      expect(hierarchy).toHaveLength(2) // docs and images
      expect(hierarchy.map(f => f.name).sort()).toEqual(['docs', 'images'])
      
      const imagesFolder = hierarchy.find(f => f.name === 'images')
      expect(imagesFolder.children).toHaveLength(2) // cats and dogs
      expect(imagesFolder.fileCount).toBe(3)
      
      const catsFolder = imagesFolder.children.find(f => f.name === 'cats')
      expect(catsFolder.fileCount).toBe(2)
    })
  })

  describe('R2 Bucket Operations', () => {
    it('should store and retrieve files correctly', async () => {
      const testData = new ArrayBuffer(1024)
      
      // Store file
      const putResult = await global.mockR2Bucket.put('test/file.jpg', testData, {
        metadata: { originalName: 'file.jpg' }
      })
      
      expect(putResult.key).toBe('test/file.jpg')
      expect(putResult.size).toBe(1024)
      
      // Retrieve file
      const getResult = await global.mockR2Bucket.get('test/file.jpg')
      
      expect(getResult).toBeTruthy()
      expect(getResult.size).toBe(1024)
      expect(getResult.metadata.originalName).toBe('file.jpg')
    })

    it('should list files with prefix filtering', async () => {
      // Seed test data
      global.mockR2Bucket.seed({
        'folder1/file1.jpg': 'content1',
        'folder1/file2.jpg': 'content2',
        'folder2/file3.jpg': 'content3'
      })
      
      const result = await global.mockR2Bucket.list({ prefix: 'folder1/' })
      
      expect(result.objects).toHaveLength(2)
      expect(result.objects.every(obj => obj.key.startsWith('folder1/'))).toBe(true)
    })
  })

  describe('Batch Upload Integration', () => {
    it('should process multiple files correctly', async () => {
      const { handleBatchUpload } = await import('../src/worker-functions.js')
      
      const files = [
        {
          name: 'file1.jpg',
          size: 1024,
          type: 'image/jpeg',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        },
        {
          name: 'file2.png',
          size: 2048,
          type: 'image/png',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
        }
      ]
      
      const folderStructure = {
        'file1.jpg': 'uploads/file1.jpg',
        'file2.png': 'uploads/file2.png'
      }
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', JSON.stringify(folderStructure))
      formData.set('conflictResolution', 'rename')
      
      // Add required methods
      formData.get = function(key) { return Map.prototype.get.call(this, key) }
      formData.getAll = function(key) {
        const value = this.get(key)
        return Array.isArray(value) ? value : value ? [value] : []
      }
      
      const request = {
        formData: () => Promise.resolve(formData)
      }
      
      const response = await handleBatchUpload(global.mockEnv, {}, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(2)
      expect(result.data.results.every(r => r.status === 'success')).toBe(true)
      
      // Verify files were stored
      const file1 = await global.mockR2Bucket.get('uploads/file1.jpg')
      const file2 = await global.mockR2Bucket.get('uploads/file2.png')
      
      expect(file1).toBeTruthy()
      expect(file2).toBeTruthy()
      expect(file1.size).toBe(1024)
      expect(file2.size).toBe(2048)
    })
  })

  describe('End-to-End Workflow', () => {
    it('should complete full upload and list workflow', async () => {
      const { handleBatchUpload, handleListFolders } = await import('../src/worker-functions.js')
      
      // 1. Upload files with folder structure
      const files = [
        {
          name: 'cat1.jpg',
          size: 1024,
          type: 'image/jpeg',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        },
        {
          name: 'dog1.jpg',
          size: 2048,
          type: 'image/jpeg',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048))
        }
      ]
      
      const folderStructure = {
        'cat1.jpg': 'animals/cats/cat1.jpg',
        'dog1.jpg': 'animals/dogs/dog1.jpg'
      }
      
      const formData = new Map()
      formData.set('files', files)
      formData.set('folderStructure', JSON.stringify(folderStructure))
      formData.set('conflictResolution', 'rename')
      
      formData.get = function(key) { return Map.prototype.get.call(this, key) }
      formData.getAll = function(key) {
        const value = this.get(key)
        return Array.isArray(value) ? value : value ? [value] : []
      }
      
      const uploadRequest = {
        formData: () => Promise.resolve(formData)
      }
      
      const uploadResponse = await handleBatchUpload(global.mockEnv, {}, uploadRequest)
      const uploadResult = JSON.parse(uploadResponse.body)
      
      expect(uploadResult.success).toBe(true)
      
      // 2. List folders to verify structure
      const listRequest = {
        url: 'http://localhost/api/folders?depth=2'
      }
      
      const listResponse = await handleListFolders(global.mockEnv, {}, listRequest)
      const listResult = JSON.parse(listResponse.body)
      
      expect(listResult.success).toBe(true)
      expect(listResult.data.folders).toHaveLength(1) // animals
      expect(listResult.data.folders[0].name).toBe('animals')
      expect(listResult.data.folders[0].children).toHaveLength(2) // cats, dogs
    })
  })
})