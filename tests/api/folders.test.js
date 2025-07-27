import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../setup.js'

// Import the functions we want to test from the worker
// Note: In a real setup, you'd extract these to separate modules
const { validateAndSanitizePath, buildFolderHierarchy, handleListFolders } = await import('../../src/worker-functions.js')

describe('Folder API Functions', () => {
  beforeEach(() => {
    global.mockR2Bucket.clear()
  })

  describe('validateAndSanitizePath', () => {
    it('should accept valid paths', () => {
      expect(() => validateAndSanitizePath('folder/subfolder')).not.toThrow()
      expect(() => validateAndSanitizePath('images/2024')).not.toThrow()
      expect(() => validateAndSanitizePath('')).not.toThrow()
    })

    it('should reject path traversal attempts', () => {
      expect(() => validateAndSanitizePath('../secrets')).toThrow('Path traversal not allowed')
      expect(() => validateAndSanitizePath('folder/../other')).toThrow('Path traversal not allowed')
    })

    it('should reject double slashes', () => {
      expect(() => validateAndSanitizePath('folder//subfolder')).toThrow('Double slashes not allowed')
    })

    it('should reject paths that are too long', () => {
      const longPath = 'a'.repeat(1025)
      expect(() => validateAndSanitizePath(longPath)).toThrow('Path too long')
    })

    it('should reject invalid characters', () => {
      expect(() => validateAndSanitizePath('folder\x00bad')).toThrow('Invalid characters in path')
      expect(() => validateAndSanitizePath('folder\x01bad')).toThrow('Invalid characters in path')
    })
  })

  describe('buildFolderHierarchy', () => {
    it('should build hierarchy from flat file list', () => {
      const files = [
        { key: 'images/cats/persian.jpg' },
        { key: 'images/cats/siamese.jpg' },
        { key: 'images/dogs/golden.jpg' },
        { key: 'docs/readme.txt' }
      ]

      const hierarchy = buildFolderHierarchy(files)
      
      expect(hierarchy).toEqual([
        {
          name: 'images',
          path: 'images',
          type: 'folder',
          children: [
            {
              name: 'cats',
              path: 'images/cats',
              type: 'folder',
              children: [],
              fileCount: 2
            },
            {
              name: 'dogs', 
              path: 'images/dogs',
              type: 'folder',
              children: [],
              fileCount: 1
            }
          ],
          fileCount: 3
        },
        {
          name: 'docs',
          path: 'docs', 
          type: 'folder',
          children: [],
          fileCount: 1
        }
      ])
    })

    it('should handle nested folder structures', () => {
      const files = [
        { key: 'projects/web/frontend/src/main.js' },
        { key: 'projects/web/backend/server.js' },
        { key: 'projects/mobile/ios/app.swift' }
      ]

      const hierarchy = buildFolderHierarchy(files)
      
      expect(hierarchy[0].name).toBe('projects')
      expect(hierarchy[0].children[0].name).toBe('web')
      expect(hierarchy[0].children[0].children).toHaveLength(2)
      expect(hierarchy[0].children[0].children[0].name).toBe('frontend')
    })

    it('should calculate file counts correctly', () => {
      const files = [
        { key: 'folder1/file1.jpg' },
        { key: 'folder1/file2.jpg' },
        { key: 'folder1/subfolder/file3.jpg' },
        { key: 'folder2/file4.jpg' }
      ]

      const hierarchy = buildFolderHierarchy(files)
      
      expect(hierarchy[0].fileCount).toBe(3) // folder1 total
      expect(hierarchy[0].children[0].fileCount).toBe(1) // subfolder
      expect(hierarchy[1].fileCount).toBe(1) // folder2
    })
  })

  describe('handleListFolders', () => {
    beforeEach(() => {
      // Seed the mock bucket with test data
      global.mockR2Bucket.seed({
        'categories/animals/cats/persian.jpg': 'image-data-1',
        'categories/animals/cats/siamese.jpg': 'image-data-2', 
        'categories/animals/dogs/golden.jpg': 'image-data-3',
        'categories/nature/mountains/alps.jpg': 'image-data-4',
        'categories/nature/oceans/pacific.jpg': 'image-data-5',
        'icons/social/facebook.svg': 'svg-data-1',
        'icons/social/twitter.svg': 'svg-data-2',
        'root-image.png': 'root-image-data'
      })
    })

    it('should list root folders', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.folders).toHaveLength(2) // categories, icons
      expect(result.data.folders.map(f => f.name)).toContain('categories')
      expect(result.data.folders.map(f => f.name)).toContain('icons')
    })

    it('should list folders with specified depth', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders?depth=2')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.folders[0].children).toBeDefined()
      expect(result.data.folders[0].children.length).toBeGreaterThan(0)
    })

    it('should include files when requested', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders?include_files=true')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.files).toBeDefined()
      expect(result.data.files).toHaveLength(1) // root-image.png
      expect(result.data.files[0].name).toBe('root-image.png')
    })

    it('should filter by path', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders?path=categories/animals')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.folders).toHaveLength(2) // cats, dogs
      expect(result.data.folders.map(f => f.name)).toContain('cats')
      expect(result.data.folders.map(f => f.name)).toContain('dogs')
    })

    it('should handle pagination', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders?limit=1')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(true)
      expect(result.data.folders).toHaveLength(1)
      expect(result.data.pagination.hasMore).toBe(true)
      expect(result.data.pagination.cursor).toBeDefined()
    })

    it('should handle invalid paths gracefully', async () => {
      const corsHeaders = {}
      const request = new Request('http://localhost/api/folders?path=../invalid')
      
      const response = await handleListFolders(global.mockEnv, corsHeaders, request)
      const result = JSON.parse(response.body)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Path traversal not allowed')
    })
  })
})