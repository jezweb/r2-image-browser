// Test setup configuration
import { vi } from 'vitest'

// Mock environment variables
process.env.AUTH_USERNAME = 'testuser'
process.env.AUTH_PASSWORD = 'testpass'

// Mock global objects that would be available in Cloudflare Workers
global.Request = class MockRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this.body = options.body
  }
  
  async json() {
    return JSON.parse(this.body || '{}')
  }
  
  async formData() {
    // Mock FormData for testing
    const formData = new Map()
    return formData
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body
    this.status = options.status || 200
    this.statusText = options.statusText || 'OK'
    this.headers = new Map(Object.entries(options.headers || {}))
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

global.URL = class MockURL {
  constructor(url) {
    const parts = url.split('?')
    this.pathname = parts[0]
    this.searchParams = new URLSearchParams(parts[1] || '')
  }
}

// Mock Cloudflare R2 bucket
global.mockR2Bucket = {
  objects: new Map(),
  
  async put(key, data, options = {}) {
    const size = data instanceof ArrayBuffer ? data.byteLength : (data.length || 0)
    this.objects.set(key, {
      data,
      metadata: options.metadata || {},
      size: size,
      uploaded: new Date().toISOString()
    })
    return {
      key,
      size: size,
      etag: 'mock-etag-' + Date.now()
    }
  },
  
  async get(key) {
    const obj = this.objects.get(key)
    if (!obj) return null
    
    return {
      key,
      size: obj.size,
      body: obj.data,
      metadata: obj.metadata,
      uploaded: obj.uploaded
    }
  },
  
  async delete(key) {
    return this.objects.delete(key)
  },
  
  async list(options = {}) {
    const prefix = options.prefix || ''
    const delimiter = options.delimiter
    const cursor = options.cursor
    const limit = options.limit || 1000
    
    const allKeys = Array.from(this.objects.keys())
      .filter(key => key.startsWith(prefix))
      .sort()
    
    const startIndex = cursor ? allKeys.indexOf(cursor) + 1 : 0
    const endIndex = Math.min(startIndex + limit, allKeys.length)
    const keys = allKeys.slice(startIndex, endIndex)
    
    const objects = keys.map(key => {
      const obj = this.objects.get(key)
      return {
        key,
        size: obj.size,
        uploaded: obj.uploaded,
        metadata: obj.metadata
      }
    })
    
    // Handle delimiter for folder-like structure
    const folders = new Set()
    const files = []
    
    if (delimiter) {
      objects.forEach(obj => {
        const remainingPath = obj.key.slice(prefix.length)
        const delimiterIndex = remainingPath.indexOf(delimiter)
        
        if (delimiterIndex > 0) {
          const folderName = remainingPath.slice(0, delimiterIndex)
          folders.add(prefix + folderName + delimiter)
        } else if (remainingPath && !remainingPath.endsWith(delimiter)) {
          files.push(obj)
        }
      })
    } else {
      files.push(...objects)
    }
    
    return {
      objects: files,
      truncated: endIndex < allKeys.length,
      cursor: endIndex < allKeys.length ? allKeys[endIndex - 1] : undefined,
      delimitedPrefixes: Array.from(folders).map(prefix => ({ prefix }))
    }
  },
  
  // Helper for tests
  clear() {
    this.objects.clear()
  },
  
  seed(data) {
    this.clear()
    Object.entries(data).forEach(([key, content]) => {
      this.objects.set(key, {
        data: content,
        metadata: {},
        size: content.length,
        uploaded: new Date().toISOString()
      })
    })
  }
}

// Mock environment binding
global.mockEnv = {
  R2_BUCKET: global.mockR2Bucket,
  AUTH_USERNAME: 'testuser',
  AUTH_PASSWORD: 'testpass'
}

// Utility functions for tests
export const createMockFile = (name, size = 1024, type = 'image/png') => {
  const file = {
    name,
    size,
    type,
    lastModified: Date.now(),
    stream: () => new ReadableStream(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(size)),
    text: () => Promise.resolve('mock-file-content')
  }
  return file
}

export const createMockFormData = (files = [], folderStructure = {}) => {
  const formData = new Map()
  
  files.forEach(file => {
    if (!formData.has('files')) {
      formData.set('files', [])
    }
    formData.get('files').push(file)
  })
  
  if (Object.keys(folderStructure).length > 0) {
    formData.set('folderStructure', JSON.stringify(folderStructure))
  }
  
  formData.get = function(key) {
    return Map.prototype.get.call(this, key)
  }
  
  formData.getAll = function(key) {
    const value = this.get(key)
    return Array.isArray(value) ? value : value ? [value] : []
  }
  
  formData.has = function(key) {
    return Map.prototype.has.call(this, key)
  }
  
  return formData
}

// Setup DOM environment for Vue component tests
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000'
})

global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement

// Mock file input capabilities
global.DataTransfer = class MockDataTransfer {
  constructor() {
    this.items = []
    this.files = []
  }
}

global.DataTransferItem = class MockDataTransferItem {
  constructor(data, type) {
    this.data = data
    this.type = type
  }
  
  webkitGetAsEntry() {
    return {
      isDirectory: this.type === 'directory',
      isFile: this.type !== 'directory',
      name: this.data.name || 'mock-entry'
    }
  }
}

// Mock clipboard API
global.navigator.clipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
}

export { vi }