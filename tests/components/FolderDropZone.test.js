import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import '../setup.js'
import FolderDropZone from '../../src/components/FolderDropZone.vue'

// Mock child components
vi.mock('../../src/components/FolderTreeNode.vue', () => ({
  default: {
    name: 'FolderTreeNode',
    template: '<div class="mock-folder-tree-node">{{ node.name }}</div>',
    props: ['node', 'level'],
    emits: ['remove-file']
  }
}))

vi.mock('../../src/components/UploadProgressTree.vue', () => ({
  default: {
    name: 'UploadProgressTree', 
    template: '<div class="mock-upload-progress">Upload Progress</div>',
    props: ['progress'],
    emits: ['copy-url']
  }
}))

describe('FolderDropZone Component', () => {
  let wrapper
  let mockAuthHeader

  beforeEach(() => {
    mockAuthHeader = 'Basic dGVzdDp0ZXN0'
    
    // Reset DOM mocks
    global.DataTransfer = class MockDataTransfer {
      constructor() {
        this.items = []
        this.files = []
      }
    }
    
    global.DataTransferItem = class MockDataTransferItem {
      constructor(data, type = 'file') {
        this.data = data
        this.type = type
      }
      
      webkitGetAsEntry() {
        return {
          isDirectory: this.type === 'directory',
          isFile: this.type === 'file',
          name: this.data.name || 'mock-entry'
        }
      }
    }
    
    // Mock global fetch
    global.fetch = vi.fn()
    
    wrapper = mount(FolderDropZone, {
      global: {
        provide: {
          authHeader: mockAuthHeader
        }
      }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Initialization', () => {
    it('should render the drop zone', () => {
      expect(wrapper.find('.dropzone').exists()).toBe(true)
      expect(wrapper.find('.dropzone-content').exists()).toBe(true)
    })

    it('should detect browser capabilities on mount', () => {
      expect(wrapper.vm.capabilities).toHaveProperty('advancedDragDrop')
      expect(wrapper.vm.capabilities).toHaveProperty('directoryInput')
      expect(wrapper.vm.capabilities).toHaveProperty('touchDevice')
    })

    it('should show appropriate message based on capabilities', () => {
      const dropZoneContent = wrapper.find('.dropzone-content')
      expect(dropZoneContent.text()).toContain('files')
    })
  })

  describe('Drag and Drop Events', () => {
    it('should handle drag over events', async () => {
      const dropZone = wrapper.find('.dropzone')
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          items: [
            new DataTransferItem({ name: 'test.jpg' }, 'file')
          ]
        }
      }
      
      await dropZone.trigger('dragover', mockEvent)
      
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.vm.isDragging).toBe(true)
    })

    it('should detect folder drag over', async () => {
      // Mock advanced drag drop capability
      wrapper.vm.capabilities.advancedDragDrop = true
      
      const dropZone = wrapper.find('.dropzone')
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          items: [
            {
              webkitGetAsEntry: () => ({ isDirectory: true })
            }
          ]
        }
      }
      
      await dropZone.trigger('dragover', mockEvent)
      
      expect(wrapper.vm.folderDetected).toBe(true)
      expect(wrapper.find('.dropzone').classes()).toContain('folder-detected')
    })

    it('should handle drag leave events', async () => {
      wrapper.vm.isDragging = true
      wrapper.vm.folderDetected = true
      
      const dropZone = wrapper.find('.dropzone')
      await dropZone.trigger('dragleave')
      
      expect(wrapper.vm.isDragging).toBe(false)
      expect(wrapper.vm.folderDetected).toBe(false)
    })

    it('should handle file drop events', async () => {
      const mockFiles = [
        { name: 'test1.jpg', size: 1024, type: 'image/jpeg' },
        { name: 'test2.png', size: 2048, type: 'image/png' }
      ]
      
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          files: mockFiles,
          items: null // Fallback to files when items not available
        }
      }
      
      const mockProcessFileList = vi.spyOn(wrapper.vm, 'processFileList')
      
      await wrapper.find('.dropzone').trigger('drop', mockEvent)
      
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(wrapper.vm.isDragging).toBe(false)
      expect(mockProcessFileList).toHaveBeenCalledWith(mockFiles)
    })
  })

  describe('File Processing', () => {
    it('should validate file types correctly', () => {
      const validFile = { type: 'image/png', size: 1024 }
      const invalidFile = { type: 'application/pdf', size: 1024 }
      const oversizedFile = { type: 'image/jpeg', size: 15 * 1024 * 1024 }
      
      expect(wrapper.vm.validateFile(validFile)).toBe(true)
      expect(wrapper.vm.validateFile(invalidFile)).toBe(false)
      expect(wrapper.vm.validateFile(oversizedFile)).toBe(false)
    })

    it('should process file list and update structure', () => {
      const mockFiles = [
        { 
          name: 'cat.jpg', 
          type: 'image/jpeg', 
          size: 1024,
          webkitRelativePath: 'animals/cats/cat.jpg'
        },
        { 
          name: 'dog.jpg', 
          type: 'image/jpeg', 
          size: 2048,
          webkitRelativePath: 'animals/dogs/dog.jpg'
        }
      ]
      
      wrapper.vm.processFileList(mockFiles)
      
      expect(wrapper.vm.selectedStructure.files).toHaveLength(2)
      expect(wrapper.vm.selectedStructure.folders.has('animals')).toBe(true)
      expect(wrapper.vm.selectedStructure.folders.has('animals/cats')).toBe(true)
      expect(wrapper.vm.selectedStructure.folders.has('animals/dogs')).toBe(true)
    })

    it('should build folder tree from processed files', async () => {
      wrapper.vm.selectedStructure = {
        files: [
          { relativePath: 'folder1/file1.jpg', name: 'file1.jpg' },
          { relativePath: 'folder1/subfolder/file2.jpg', name: 'file2.jpg' },
          { relativePath: 'folder2/file3.png', name: 'file3.png' }
        ],
        folders: new Set(['folder1', 'folder1/subfolder', 'folder2'])
      }
      
      await nextTick()
      
      const tree = wrapper.vm.folderTree
      expect(tree).toHaveLength(2) // folder1 and folder2
      expect(tree[0].children).toHaveLength(1) // subfolder
    })
  })

  describe('File Upload', () => {
    beforeEach(() => {
      wrapper.vm.selectedStructure = {
        files: [
          { 
            file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
            relativePath: 'uploads/test.jpg',
            name: 'test.jpg',
            size: 1024,
            type: 'image/jpeg'
          }
        ],
        folders: new Set(['uploads'])
      }
    })

    it('should prepare upload data correctly', async () => {
      const mockResponse = {
        success: true,
        data: {
          results: [
            {
              originalName: 'test.jpg',
              finalPath: 'uploads/test.jpg',
              status: 'success',
              size: 1024,
              url: 'http://example.com/test.jpg'
            }
          ]
        }
      }
      
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      })
      
      await wrapper.vm.startUpload()
      
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/upload/batch', {
        method: 'POST',
        headers: {
          'Authorization': mockAuthHeader
        },
        body: expect.any(FormData)
      })
    })

    it('should handle upload success', async () => {
      const mockResponse = {
        success: true,
        data: {
          results: [
            {
              originalName: 'test.jpg',
              finalPath: 'uploads/test.jpg',
              status: 'success',
              size: 1024,
              url: 'http://example.com/test.jpg'
            }
          ]
        }
      }
      
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      })
      
      await wrapper.vm.startUpload()
      
      expect(wrapper.vm.uploadProgress).toHaveLength(1)
      expect(wrapper.vm.uploadProgress[0].status).toBe('success')
      expect(wrapper.vm.selectedStructure.files).toHaveLength(0) // Cleared after upload
      expect(wrapper.emitted().uploaded).toBeTruthy()
    })

    it('should handle upload errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      await wrapper.vm.startUpload()
      
      expect(wrapper.vm.uploadProgress).toHaveLength(1)
      expect(wrapper.vm.uploadProgress[0].status).toBe('failed')
      expect(wrapper.vm.uploadProgress[0].error).toBe('Network error')
    })

    it('should prevent upload when no files selected', async () => {
      wrapper.vm.selectedStructure.files = []
      
      await wrapper.vm.startUpload()
      
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('File Selection', () => {
    it('should show file selector on click when no advanced capabilities', async () => {
      wrapper.vm.capabilities.directoryInput = false
      
      const mockClick = vi.fn()
      const mockInput = { click: mockClick }
      document.querySelector = vi.fn().mockReturnValue(mockInput)
      
      await wrapper.find('.dropzone').trigger('click')
      
      expect(document.querySelector).toHaveBeenCalledWith('input[type="file"][multiple]')
      expect(mockClick).toHaveBeenCalled()
    })

    it('should show choice dialog when directory input supported', async () => {
      wrapper.vm.capabilities.directoryInput = true
      
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const mockClick = vi.fn()
      document.querySelector = vi.fn().mockReturnValue({ click: mockClick })
      
      await wrapper.find('.dropzone').trigger('click')
      
      expect(mockConfirm).toHaveBeenCalled()
      expect(document.querySelector).toHaveBeenCalledWith('input[webkitdirectory]')
    })
  })

  describe('Upload Controls', () => {
    beforeEach(async () => {
      wrapper.vm.selectedStructure.files = [
        { name: 'test.jpg', relativePath: 'test.jpg' }
      ]
      await nextTick()
    })

    it('should show upload controls when files selected', () => {
      expect(wrapper.find('.structure-preview').exists()).toBe(true)
      expect(wrapper.find('.upload-controls').exists()).toBe(true)
    })

    it('should update target path', async () => {
      const pathInput = wrapper.find('.path-input')
      await pathInput.setValue('custom/folder')
      
      expect(wrapper.vm.targetPath).toBe('custom/folder')
    })

    it('should update conflict resolution', async () => {
      const conflictSelect = wrapper.find('.conflict-select')
      await conflictSelect.setValue('overwrite')
      
      expect(wrapper.vm.conflictResolution).toBe('overwrite')
    })

    it('should disable upload button during upload', async () => {
      wrapper.vm.isUploading = true
      await nextTick()
      
      const uploadBtn = wrapper.find('.upload-btn')
      expect(uploadBtn.attributes('disabled')).toBeDefined()
    })

    it('should clear selection when clear button clicked', async () => {
      const clearBtn = wrapper.find('.clear-btn')
      await clearBtn.trigger('click')
      
      expect(wrapper.vm.selectedStructure.files).toHaveLength(0)
      expect(wrapper.vm.selectedStructure.folders.size).toBe(0)
    })
  })

  describe('Dynamic UI Updates', () => {
    it('should update drop zone appearance based on state', async () => {
      const dropZone = wrapper.find('.dropzone')
      
      // Default state
      expect(dropZone.classes()).not.toContain('dragging')
      expect(dropZone.classes()).not.toContain('folder-detected')
      expect(dropZone.classes()).not.toContain('has-files')
      
      // Dragging state
      wrapper.vm.isDragging = true
      await nextTick()
      expect(dropZone.classes()).toContain('dragging')
      
      // Folder detected state
      wrapper.vm.folderDetected = true
      await nextTick()
      expect(dropZone.classes()).toContain('folder-detected')
      
      // Has files state
      wrapper.vm.selectedStructure.files = [{ name: 'test.jpg' }]
      await nextTick()
      expect(dropZone.classes()).toContain('has-files')
    })

    it('should update drop zone icon and text based on state', async () => {
      // Default state
      expect(wrapper.vm.getDropZoneIcon()).toBe('pi pi-upload')
      expect(wrapper.vm.getDropZoneTitle()).toContain('Files')
      
      // Uploading state
      wrapper.vm.isUploading = true
      expect(wrapper.vm.getDropZoneIcon()).toBe('pi pi-spin pi-spinner')
      
      // Folder detected state
      wrapper.vm.isUploading = false
      wrapper.vm.folderDetected = true
      expect(wrapper.vm.getDropZoneIcon()).toBe('pi pi-folder-open')
      
      // Files selected state
      wrapper.vm.folderDetected = false
      wrapper.vm.selectedStructure.files = [{ name: 'test.jpg' }]
      expect(wrapper.vm.getDropZoneIcon()).toBe('pi pi-check-circle')
      expect(wrapper.vm.getDropZoneTitle()).toContain('1 files selected')
    })
  })

  describe('File Management', () => {
    beforeEach(async () => {
      wrapper.vm.selectedStructure.files = [
        { relativePath: 'folder/file1.jpg', name: 'file1.jpg' },
        { relativePath: 'folder/file2.jpg', name: 'file2.jpg' }
      ]
      await nextTick()
    })

    it('should remove file from selection', () => {
      const fileToRemove = { relativePath: 'folder/file1.jpg' }
      
      wrapper.vm.removeFile(fileToRemove)
      
      expect(wrapper.vm.selectedStructure.files).toHaveLength(1)
      expect(wrapper.vm.selectedStructure.files[0].name).toBe('file2.jpg')
    })

    it('should emit uploaded event on successful upload', async () => {
      const mockResponse = {
        success: true,
        data: { results: [] }
      }
      
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      })
      
      await wrapper.vm.startUpload()
      
      expect(wrapper.emitted().uploaded).toBeTruthy()
      expect(wrapper.emitted().uploaded[0][0]).toEqual(mockResponse.data)
    })
  })
})