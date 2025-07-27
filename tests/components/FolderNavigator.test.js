import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import '../setup.js'
import FolderNavigator from '../../src/components/FolderNavigator.vue'

// Mock child components
vi.mock('../../src/components/FolderTreeView.vue', () => ({
  default: {
    name: 'FolderTreeView',
    template: '<div class="mock-folder-tree-view">Mock Tree View</div>',
    props: ['folders', 'currentPath', 'expandedFolders'],
    emits: ['navigate', 'toggle-expand']
  }
}))

describe('FolderNavigator Component', () => {
  let wrapper
  let mockAuthHeader

  beforeEach(() => {
    mockAuthHeader = 'Basic dGVzdDp0ZXN0'
    
    // Mock global fetch
    global.fetch = vi.fn()
    
    wrapper = mount(FolderNavigator, {
      props: {
        initialPath: ''
      },
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
    it('should render the navigator header', () => {
      expect(wrapper.find('.navigator-header').exists()).toBe(true)
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(true)
      expect(wrapper.find('.nav-controls').exists()).toBe(true)
    })

    it('should show root breadcrumb by default', () => {
      const rootBreadcrumb = wrapper.find('.breadcrumb-btn')
      expect(rootBreadcrumb.exists()).toBe(true)
      expect(rootBreadcrumb.text()).toContain('Root')
    })

    it('should initialize with correct default state', () => {
      expect(wrapper.vm.currentPath).toBe('')
      expect(wrapper.vm.viewMode).toBe('grid')
      expect(wrapper.vm.sortBy).toBe('name')
      expect(wrapper.vm.sortOrder).toBe('asc')
    })
  })

  describe('Navigation Controls', () => {
    it('should disable back button when no history', () => {
      const backBtn = wrapper.find('.back-btn')
      expect(backBtn.attributes('disabled')).toBeDefined()
    })

    it('should disable forward button when no forward history', () => {
      const forwardBtn = wrapper.find('.forward-btn')
      expect(forwardBtn.attributes('disabled')).toBeDefined()
    })

    it('should toggle tree view when tree button clicked', async () => {
      const treeToggleBtn = wrapper.find('.tree-toggle-btn')
      expect(wrapper.vm.showTreeView).toBe(false)
      
      await treeToggleBtn.trigger('click')
      expect(wrapper.vm.showTreeView).toBe(true)
      expect(treeToggleBtn.classes()).toContain('active')
    })

    it('should call refresh when refresh button clicked', async () => {
      const mockLoadFolderContents = vi.spyOn(wrapper.vm, 'loadFolderContents')
      const refreshBtn = wrapper.find('.refresh-btn')
      
      await refreshBtn.trigger('click')
      expect(mockLoadFolderContents).toHaveBeenCalled()
    })
  })

  describe('Breadcrumb Navigation', () => {
    beforeEach(async () => {
      // Set a nested path
      wrapper.vm.currentPath = 'categories/animals/cats'
      await nextTick()
    })

    it('should render breadcrumb segments for nested paths', () => {
      const breadcrumbItems = wrapper.findAll('.breadcrumb-item')
      // Root + 3 path segments
      expect(breadcrumbItems.length).toBe(4)
    })

    it('should navigate to segment when breadcrumb clicked', async () => {
      const mockNavigateToPath = vi.spyOn(wrapper.vm, 'navigateToPath')
      const breadcrumbBtns = wrapper.findAll('.breadcrumb-btn')
      
      // Click on second segment (categories)
      await breadcrumbBtns[1].trigger('click')
      expect(mockNavigateToPath).toHaveBeenCalledWith('categories')
    })

    it('should navigate to root when root breadcrumb clicked', async () => {
      const mockNavigateToPath = vi.spyOn(wrapper.vm, 'navigateToPath')
      const rootBreadcrumb = wrapper.find('.breadcrumb-btn')
      
      await rootBreadcrumb.trigger('click')
      expect(mockNavigateToPath).toHaveBeenCalledWith('')
    })
  })

  describe('Folder Content Loading', () => {
    it('should show loading state during folder load', async () => {
      // Mock fetch to be pending
      global.fetch.mockImplementation(() => new Promise(() => {}))
      
      wrapper.vm.loadFolderContents('test-path')
      await nextTick()
      
      expect(wrapper.vm.isLoading).toBe(true)
      expect(wrapper.find('.loading-content').exists()).toBe(true)
    })

    it('should load folder contents successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          folders: [
            { name: 'cats', path: 'animals/cats', fileCount: 5 },
            { name: 'dogs', path: 'animals/dogs', fileCount: 3 }
          ],
          files: [
            { name: 'animal.jpg', size: 1024, url: 'http://example.com/animal.jpg' }
          ]
        }
      }
      
      global.fetch.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      })
      
      await wrapper.vm.loadFolderContents('animals')
      
      expect(wrapper.vm.folders).toHaveLength(2)
      expect(wrapper.vm.files).toHaveLength(1)
      expect(wrapper.vm.isLoading).toBe(false)
    })

    it('should handle folder load errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      await wrapper.vm.loadFolderContents('invalid-path')
      
      expect(wrapper.vm.error).toBe('Network error')
      expect(wrapper.vm.folders).toHaveLength(0)
      expect(wrapper.vm.files).toHaveLength(0)
    })
  })

  describe('View Controls', () => {
    it('should switch between grid and list view modes', async () => {
      const listViewBtn = wrapper.findAll('.view-btn')[1]
      
      expect(wrapper.vm.viewMode).toBe('grid')
      await listViewBtn.trigger('click')
      expect(wrapper.vm.viewMode).toBe('list')
    })

    it('should update sort criteria', async () => {
      const sortSelect = wrapper.find('.sort-select')
      
      await sortSelect.setValue('date')
      expect(wrapper.vm.sortBy).toBe('date')
    })

    it('should toggle sort order', async () => {
      const sortOrderBtn = wrapper.find('.sort-order-btn')
      
      expect(wrapper.vm.sortOrder).toBe('asc')
      await sortOrderBtn.trigger('click')
      expect(wrapper.vm.sortOrder).toBe('desc')
    })
  })

  describe('Folder Operations', () => {
    beforeEach(async () => {
      // Set up folders for testing
      wrapper.vm.folders = [
        { name: 'test-folder', path: 'test-folder', fileCount: 2 }
      ]
      await nextTick()
    })

    it('should navigate to folder when clicked', async () => {
      const mockNavigateToPath = vi.spyOn(wrapper.vm, 'navigateToPath')
      const folderItem = wrapper.find('.folder-item')
      
      await folderItem.trigger('click')
      expect(mockNavigateToPath).toHaveBeenCalledWith('test-folder')
    })

    it('should show context menu on folder action button click', async () => {
      const actionBtn = wrapper.find('.action-btn')
      const mockEvent = { clientX: 100, clientY: 200, stopPropagation: vi.fn() }
      
      await actionBtn.trigger('click', mockEvent)
      
      expect(wrapper.vm.contextMenu.show).toBe(true)
      expect(wrapper.vm.contextMenu.x).toBe(100)
      expect(wrapper.vm.contextMenu.y).toBe(200)
    })

    it('should emit folder action events', async () => {
      // Show context menu first
      wrapper.vm.contextMenu = {
        show: true,
        x: 100,
        y: 200,
        folder: { name: 'test-folder', path: 'test-folder' }
      }
      await nextTick()
      
      const createBtn = wrapper.find('.menu-item')
      await createBtn.trigger('click')
      
      expect(wrapper.emitted()['folder-action']).toBeTruthy()
      expect(wrapper.emitted()['folder-action'][0][0]).toEqual({
        action: 'create',
        folder: { name: 'test-folder', path: 'test-folder' }
      })
    })
  })

  describe('File Operations', () => {
    beforeEach(async () => {
      wrapper.vm.files = [
        { 
          name: 'test.jpg', 
          path: 'folder/test.jpg',
          size: 1024,
          url: 'http://example.com/test.jpg',
          lastModified: '2024-01-01T00:00:00Z'
        }
      ]
      await nextTick()
    })

    it('should emit file-selected event when file clicked', async () => {
      const fileItem = wrapper.find('.file-item')
      
      await fileItem.trigger('click')
      
      expect(wrapper.emitted()['file-selected']).toBeTruthy()
      expect(wrapper.emitted()['file-selected'][0][0].name).toBe('test.jpg')
    })

    it('should copy file URL when copy button clicked', async () => {
      const copyBtn = wrapper.find('.file-item .action-btn')
      
      await copyBtn.trigger('click')
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://example.com/test.jpg')
    })
  })

  describe('Tree View', () => {
    beforeEach(async () => {
      wrapper.vm.showTreeView = true
      await nextTick()
    })

    it('should show tree sidebar when enabled', () => {
      expect(wrapper.find('.tree-sidebar').exists()).toBe(true)
      expect(wrapper.find('.mock-folder-tree-view').exists()).toBe(true)
    })

    it('should expand all folders when expand all clicked', async () => {
      wrapper.vm.folderTree = [
        {
          name: 'folder1',
          children: [
            { name: 'subfolder1' },
            { name: 'subfolder2' }
          ]
        }
      ]
      
      const expandAllBtn = wrapper.find('.expand-all-btn')
      await expandAllBtn.trigger('click')
      
      expect(wrapper.vm.expandedFolders.has('')).toBe(true)
      expect(wrapper.vm.expandedFolders.has('folder1')).toBe(true)
    })

    it('should collapse all folders when collapse all clicked', async () => {
      wrapper.vm.expandedFolders.add('folder1')
      wrapper.vm.expandedFolders.add('folder1/subfolder1')
      
      const collapseAllBtn = wrapper.find('.collapse-all-btn')
      await collapseAllBtn.trigger('click')
      
      expect(wrapper.vm.expandedFolders.size).toBe(1) // Only root should remain
      expect(wrapper.vm.expandedFolders.has('')).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    it('should correctly calculate folder and file counts', async () => {
      wrapper.vm.folders = [{ name: 'f1' }, { name: 'f2' }]
      wrapper.vm.files = [{ name: 'file1.jpg' }, { name: 'file2.png' }, { name: 'file3.gif' }]
      await nextTick()
      
      expect(wrapper.vm.folderCount).toBe(2)
      expect(wrapper.vm.fileCount).toBe(3)
    })

    it('should sort folders correctly', async () => {
      wrapper.vm.folders = [
        { name: 'zebra', lastModified: '2024-01-01' },
        { name: 'apple', lastModified: '2024-01-02' },
        { name: 'banana', lastModified: '2024-01-03' }
      ]
      
      // Test name sorting (default)
      expect(wrapper.vm.sortedFolders[0].name).toBe('apple')
      expect(wrapper.vm.sortedFolders[2].name).toBe('zebra')
      
      // Test date sorting
      wrapper.vm.sortBy = 'date'
      await nextTick()
      expect(wrapper.vm.sortedFolders[0].name).toBe('zebra') // oldest first
    })

    it('should sort files correctly', async () => {
      wrapper.vm.files = [
        { name: 'large.jpg', size: 3000, type: 'image/jpeg' },
        { name: 'small.png', size: 1000, type: 'image/png' },
        { name: 'medium.gif', size: 2000, type: 'image/gif' }
      ]
      
      // Test size sorting
      wrapper.vm.sortBy = 'size'
      await nextTick()
      expect(wrapper.vm.sortedFiles[0].name).toBe('small.png')
      expect(wrapper.vm.sortedFiles[2].name).toBe('large.jpg')
      
      // Test type sorting
      wrapper.vm.sortBy = 'type'
      await nextTick()
      expect(wrapper.vm.sortedFiles[0].name).toBe('medium.gif') // gif comes first
    })
  })

  describe('Utility Functions', () => {
    it('should format file sizes correctly', () => {
      expect(wrapper.vm.formatSize(0)).toBe('0 B')
      expect(wrapper.vm.formatSize(1024)).toBe('1 KB')
      expect(wrapper.vm.formatSize(1024 * 1024)).toBe('1 MB')
      expect(wrapper.vm.formatSize(1536)).toBe('1.5 KB')
    })

    it('should format dates correctly', () => {
      const testDate = '2024-01-15T10:30:00Z'
      const formatted = wrapper.vm.formatDate(testDate)
      
      expect(formatted).toContain('1/15/2024') // Or local format
      expect(formatted).toContain('10:30') // Time component
    })

    it('should build nested tree from flat folder list', () => {
      const flatFolders = [
        { path: 'a', name: 'a' },
        { path: 'a/b', name: 'b' },
        { path: 'a/b/c', name: 'c' },
        { path: 'x', name: 'x' }
      ]
      
      const tree = wrapper.vm.buildNestedTree(flatFolders)
      
      expect(tree).toHaveLength(2) // a and x at root level
      expect(tree[0].name).toBe('a')
      expect(tree[0].children).toHaveLength(1) // b
      expect(tree[0].children[0].children).toHaveLength(1) // c
    })
  })
})