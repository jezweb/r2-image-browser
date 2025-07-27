// Utility Functions for Hierarchical Operations
function validateAndSanitizePath(path) {
  if (!path || typeof path !== 'string') return '';
  
  // Remove leading/trailing slashes and whitespace
  path = path.trim().replace(/^\/+|\/+$/g, '');
  
  // Security checks
  if (path.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  if (path.includes('//')) {
    throw new Error('Double slashes not allowed');
  }
  
  // Character validation
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(path)) {
    throw new Error('Invalid characters in path');
  }
  
  // Length validation
  if (path.length > 900) {
    throw new Error('Path too long');
  }
  
  // Sanitize path segments
  const segments = path.split('/').map(segment => {
    return segment.replace(/[\x00-\x1f]/g, '').trim();
  }).filter(segment => segment.length > 0);
  
  return segments.join('/');
}

function extractFilesFromObjects(objects, parentPath) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  
  return objects
    .filter(obj => 
      // Must be an image file
      imageExtensions.some(ext => obj.key.toLowerCase().endsWith(ext)) &&
      // Exclude .thumb directories
      !obj.key.includes('/.thumb/') &&
      // Exclude placeholder files
      !obj.key.endsWith('/.folder-placeholder')
    )
    .map(obj => ({
      name: obj.key.split('/').pop(),
      path: obj.key,
      type: 'file',
      size: obj.size,
      contentType: getContentTypeFromExtension(obj.key),
      lastModified: obj.uploaded,
      url: `https://icons.jezweb.com/${encodeURIComponent(obj.key).replace(/%2F/g, '/')}`
    }));
}

function buildFolderHierarchy(objects, parentPath, maxDepth) {
  const folders = new Map();
  const files = [];
  const parentSegments = parentPath ? parentPath.split('/').length : 0;
  
  for (const obj of objects) {
    // Skip system files
    if (obj.key.includes('/.thumb/') || obj.key.endsWith('/.folder-placeholder')) {
      continue;
    }
    
    const segments = obj.key.split('/');
    const depth = segments.length - parentSegments - 1; // -1 for filename
    
    if (depth > maxDepth) continue;
    
    // If it's a file at the current level
    if (segments.length === parentSegments + 1) {
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      if (imageExtensions.some(ext => obj.key.toLowerCase().endsWith(ext))) {
        files.push({
          name: segments[segments.length - 1],
          path: obj.key,
          type: 'file',
          size: obj.size,
          contentType: getContentTypeFromExtension(obj.key),
          lastModified: obj.uploaded,
          url: `https://icons.jezweb.com/${encodeURIComponent(obj.key).replace(/%2F/g, '/')}`
        });
      }
    } else if (segments.length > parentSegments + 1) {
      // It's in a subfolder
      const folderPath = segments.slice(0, parentSegments + 1).join('/');
      const folderName = segments[parentSegments];
      
      if (!folders.has(folderPath)) {
        folders.set(folderPath, {
          name: folderName,
          path: folderPath,
          type: 'folder',
          fileCount: 0,
          totalSize: 0
        });
      }
      
      // Update folder stats
      const folder = folders.get(folderPath);
      folder.fileCount++;
      folder.totalSize += obj.size || 0;
    }
  }
  
  return {
    folders: Array.from(folders.values()),
    files
  };
}

function getContentTypeFromExtension(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Basic Authentication check function
function isAuthenticated(request, env) {
  const authorization = request.headers.get('Authorization');
  
  if (!authorization || !authorization.startsWith('Basic ')) {
    return false;
  }
  
  try {
    const encoded = authorization.substring(6); // Remove 'Basic ' prefix
    const decoded = atob(encoded);
    const [username, password] = decoded.split(':');
    
    // Use environment variables or default credentials
    const validUsername = env.BASIC_USER || 'jezweb';
    const validPassword = env.BASIC_PASS || 'iconbrowser';
    
    return username === validUsername && password === validPassword;
  } catch (error) {
    return false;
  }
}

// Authentication required response
function unauthorizedResponse() {
  return new Response(JSON.stringify({
    success: false,
    error: 'Authentication required'
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers for API responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Check if this is an API route that requires authentication
    const isAPIRoute = url.pathname.startsWith('/api/');
    
    if (isAPIRoute && !isAuthenticated(request, env)) {
      return unauthorizedResponse();
    }

    // API Routes
    if (url.pathname === '/api/folders') {
      return handleListFolders(env, corsHeaders, request);
    }
    
    if (url.pathname === '/api/images') {
      const folder = url.searchParams.get('folder');
      return handleListImages(env, folder, corsHeaders);
    }
    
    // Admin API Routes
    if (url.pathname === '/api/admin/stats') {
      return handleGetStats(env, corsHeaders);
    }
    
    if (url.pathname === '/api/admin/upload' && request.method === 'POST') {
      return handleUpload(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/admin/upload/batch' && request.method === 'POST') {
      return handleBatchUpload(request, env, corsHeaders);
    }
    
    // Folder Management Routes
    if (url.pathname === '/api/admin/folders' && request.method === 'POST') {
      return handleCreateFolder(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/admin/folders/nested' && request.method === 'POST') {
      return handleCreateNestedFolder(request, env, corsHeaders);
    }
    
    if (url.pathname === '/api/admin/folders/move' && request.method === 'PUT') {
      return handleMoveFolder(request, env, corsHeaders);
    }
    
    if (url.pathname.startsWith('/api/admin/folders/') && request.method === 'PUT') {
      const folderName = decodeURIComponent(url.pathname.replace('/api/admin/folders/', ''));
      return handleRenameFolder(request, env, corsHeaders, folderName);
    }
    
    if (url.pathname === '/api/admin/folders/recursive' && request.method === 'DELETE') {
      const folderPath = new URL(request.url).searchParams.get('path');
      return handleDeleteFolderRecursive(request, env, corsHeaders, folderPath);
    }
    
    if (url.pathname.startsWith('/api/admin/folders/') && request.method === 'DELETE') {
      const folderName = decodeURIComponent(url.pathname.replace('/api/admin/folders/', ''));
      return handleDeleteFolder(request, env, corsHeaders, folderName);
    }

    // Serve static assets (Vue app)
    // For client-side routing, serve index.html for non-asset requests
    if (!url.pathname.includes('.') && url.pathname !== '/') {
      // Fetch index.html directly
      return env.ASSETS.fetch('/index.html');
    }
    
    return env.ASSETS.fetch(request);
  },
};

async function handleListFolders(env, corsHeaders, request) {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';
    const depth = parseInt(url.searchParams.get('depth') || '1');
    const includeFiles = url.searchParams.get('include_files') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate and sanitize path
    const sanitizedPath = validateAndSanitizePath(path);
    
    // Build R2 list options
    const r2Options = {
      prefix: sanitizedPath ? `${sanitizedPath}/` : '',
      delimiter: depth === 1 ? '/' : undefined,
      limit: Math.min(limit, 1000) // R2 maximum
    };

    const listed = await env.IMAGE_BUCKET.list(r2Options);
    
    let folders = [];
    let files = [];

    if (depth === 1) {
      // Simple folder listing (immediate children only)
      folders = (listed.delimitedPrefixes || [])
        .filter(prefix => !prefix.includes('/.thumb/') && !prefix.endsWith('/.folder-placeholder'))
        .map(prefix => {
          const folderPath = prefix.replace(/\/$/, '');
          const folderName = folderPath.split('/').pop();
          return {
            name: folderName,
            path: folderPath,
            type: 'folder'
          };
        });

      if (includeFiles) {
        files = await extractFilesFromObjects(listed.objects || [], sanitizedPath);
      }
    } else {
      // Deep listing - build hierarchical structure
      const hierarchyResult = buildFolderHierarchy(listed.objects || [], sanitizedPath, depth);
      folders = hierarchyResult.folders;
      files = hierarchyResult.files;
    }

    // Apply pagination
    const totalItems = folders.length + files.length;
    const allItems = [...folders, ...files];
    const paginatedItems = allItems.slice(offset, offset + limit);
    const paginatedFolders = paginatedItems.filter(item => item.type === 'folder');
    const paginatedFiles = paginatedItems.filter(item => item.type === 'file');

    return new Response(JSON.stringify({
      success: true,
      data: {
        path: sanitizedPath,
        folders: paginatedFolders,
        files: includeFiles ? paginatedFiles : [],
        pagination: {
          total: totalItems,
          limit,
          offset,
          hasMore: offset + limit < totalItems
        }
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleListImages(env, folder, corsHeaders) {
  try {
    // Only show images if a folder is specified
    if (!folder) {
      return new Response(JSON.stringify({
        success: true,
        images: []
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const options = {
      limit: 1000,
      prefix: `${folder}/`,
      delimiter: '/' // This ensures we only get files in this folder, not subfolders
    };

    const listed = await env.IMAGE_BUCKET.list(options);
    
    // Filter only image files and exclude any from .thumb subdirectories
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const images = (listed.objects || [])
      .filter(obj => 
        imageExtensions.some(ext => obj.key.toLowerCase().endsWith(ext)) &&
        !obj.key.includes('/.thumb/')
      );

    return new Response(JSON.stringify({
      success: true,
      folder: folder,
      images: images.map(obj => ({
        key: obj.key,
        name: obj.key.split('/').pop(),
        size: obj.size,
        uploaded: obj.uploaded,
        url: `https://icons.jezweb.com/${encodeURIComponent(obj.key).replace(/%2F/g, '/')}`
      }))
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleGetStats(env, corsHeaders) {
  try {
    // Get bucket statistics
    const listed = await env.IMAGE_BUCKET.list({ limit: 1000 });
    
    let totalFiles = 0;
    let totalSize = 0;
    let fileTypes = {};
    let folderCount = new Set();
    
    // Process all objects
    for (const obj of listed.objects || []) {
      // Skip .thumb directory
      if (obj.key.includes('/.thumb/')) continue;
      
      totalFiles++;
      totalSize += obj.size || 0;
      
      // Count file types
      const ext = obj.key.split('.').pop().toLowerCase();
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      
      // Count folders
      const folder = obj.key.split('/')[0];
      if (folder) folderCount.add(folder);
    }
    
    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalFiles,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        folderCount: folderCount.size,
        fileTypes,
        lastUpdated: new Date().toISOString()
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleUpload(request, env, corsHeaders) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const folder = formData.get('folder') || '';
    const files = formData.getAll('files');
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No files provided'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const uploadResults = [];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        uploadResults.push({
          name: file.name,
          success: false,
          error: `Invalid file type: ${file.type}`
        });
        continue;
      }
      
      // Validate file size
      if (file.size > maxSize) {
        uploadResults.push({
          name: file.name,
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: 10MB)`
        });
        continue;
      }
      
      // Construct the key (path in R2)
      const key = folder ? `${folder}/${file.name}` : file.name;
      
      try {
        // Upload to R2
        await env.IMAGE_BUCKET.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          }
        });
        
        uploadResults.push({
          name: file.name,
          success: true,
          key: key,
          url: `https://icons.jezweb.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`
        });
      } catch (uploadError) {
        uploadResults.push({
          name: file.name,
          success: false,
          error: uploadError.message
        });
      }
    }
    
    // Count successful uploads
    const successCount = uploadResults.filter(r => r.success).length;
    
    return new Response(JSON.stringify({
      success: successCount > 0,
      message: `Successfully uploaded ${successCount} of ${files.length} files`,
      results: uploadResults
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleBatchUpload(request, env, corsHeaders) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files');
    const folderStructureStr = formData.get('folderStructure');
    const targetPath = formData.get('targetPath') || '';
    const conflictResolution = formData.get('conflictResolution') || 'rename';
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No files provided'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let folderStructure = {};
    if (folderStructureStr) {
      try {
        folderStructure = JSON.parse(folderStructureStr);
      } catch (parseError) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid folder structure format'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    // Validate target path
    let sanitizedTargetPath = '';
    if (targetPath) {
      try {
        sanitizedTargetPath = validateAndSanitizePath(targetPath);
      } catch (validationError) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid target path: ${validationError.message}`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }
    
    const uploadResults = [];
    const failedUploads = [];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    // Create a set to track which folders we need to create
    const foldersToCreate = new Set();
    
    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          failedUploads.push({
            originalName: file.name,
            error: `Invalid file type: ${file.type}`,
            status: 'failed'
          });
          continue;
        }
        
        // Validate file size
        if (file.size > maxSize) {
          failedUploads.push({
            originalName: file.name,
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: 10MB)`,
            status: 'failed'
          });
          continue;
        }
        
        // Determine the target path for this file
        let filePath = folderStructure[file.name] || file.name;
        
        // Add target path prefix if specified
        if (sanitizedTargetPath) {
          filePath = `${sanitizedTargetPath}/${filePath}`;
        }
        
        // Validate and sanitize the file path
        let sanitizedFilePath;
        try {
          // Split path and filename
          const pathParts = filePath.split('/');
          const fileName = pathParts.pop();
          const folderPath = pathParts.join('/');
          
          const sanitizedFolderPath = folderPath ? validateAndSanitizePath(folderPath) : '';
          const sanitizedFileName = validateFileName(fileName);
          
          sanitizedFilePath = sanitizedFolderPath ? 
            `${sanitizedFolderPath}/${sanitizedFileName}` : sanitizedFileName;
          
          // Track folder that needs to be created
          if (sanitizedFolderPath) {
            foldersToCreate.add(sanitizedFolderPath);
          }
        } catch (validationError) {
          failedUploads.push({
            originalName: file.name,
            error: `Invalid path: ${validationError.message}`,
            status: 'failed'
          });
          continue;
        }
        
        // Handle conflict resolution
        let finalPath = sanitizedFilePath;
        if (conflictResolution === 'rename') {
          finalPath = await getUniqueFileName(env, sanitizedFilePath);
        } else if (conflictResolution === 'skip') {
          const exists = await fileExists(env, sanitizedFilePath);
          if (exists) {
            uploadResults.push({
              originalName: file.name,
              finalPath: sanitizedFilePath,
              status: 'skipped',
              note: 'File already exists'
            });
            continue;
          }
        }
        // 'overwrite' mode doesn't need special handling
        
        // Upload the file
        await env.IMAGE_BUCKET.put(finalPath, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
          customMetadata: {
            'x-original-name': file.name,
            'x-upload-batch': 'true',
            'x-uploaded-at': new Date().toISOString()
          }
        });
        
        uploadResults.push({
          originalName: file.name,
          finalPath: finalPath,
          url: `https://icons.jezweb.com/${encodeURIComponent(finalPath).replace(/%2F/g, '/')}`,
          size: file.size,
          status: 'success',
          note: finalPath !== sanitizedFilePath ? 'Renamed due to conflict' : undefined
        });
        
      } catch (uploadError) {
        failedUploads.push({
          originalName: file.name,
          error: uploadError.message,
          status: 'failed'
        });
      }
    }
    
    // Create all necessary folders
    const createdFolders = [];
    for (const folderPath of foldersToCreate) {
      try {
        const exists = await folderExists(env, folderPath);
        if (!exists) {
          await createFolderPlaceholder(env, folderPath);
          createdFolders.push(folderPath);
        }
      } catch (folderError) {
        console.warn(`Failed to create folder ${folderPath}:`, folderError.message);
      }
    }
    
    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const skippedCount = uploadResults.filter(r => r.status === 'skipped').length;
    
    return new Response(JSON.stringify({
      success: successCount > 0,
      message: `Processed ${files.length} files: ${successCount} successful, ${skippedCount} skipped, ${failedUploads.length} failed`,
      data: {
        totalFiles: files.length,
        successfulUploads: successCount,
        skippedUploads: skippedCount,
        failedUploads: failedUploads.length,
        createdFolders: createdFolders.length,
        results: uploadResults,
        failures: failedUploads,
        folders: createdFolders
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Helper functions for batch upload
function validateFileName(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }
  
  const invalidChars = /[<>:"|?*\x00-\x1f\/\\]/;
  if (invalidChars.test(filename)) {
    throw new Error('Invalid characters in filename');
  }
  
  if (filename.length > 255) {
    throw new Error('Filename too long');
  }
  
  return filename.trim();
}

async function fileExists(env, filePath) {
  try {
    const obj = await env.IMAGE_BUCKET.head(filePath);
    return obj !== null;
  } catch (error) {
    return false;
  }
}

async function getUniqueFileName(env, originalPath) {
  let counter = 1;
  let uniquePath = originalPath;
  
  while (await fileExists(env, uniquePath)) {
    const pathParts = originalPath.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');
    
    const nameParts = fileName.split('.');
    const extension = nameParts.pop();
    const baseName = nameParts.join('.');
    
    const newFileName = `${baseName}-${counter}.${extension}`;
    uniquePath = folderPath ? `${folderPath}/${newFileName}` : newFileName;
    counter++;
    
    // Prevent infinite loops
    if (counter > 1000) {
      throw new Error('Unable to generate unique filename');
    }
  }
  
  return uniquePath;
}

async function handleCreateFolder(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const folderName = body.name?.trim();
    
    if (!folderName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder name is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder name can only contain letters, numbers, hyphens, and underscores'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Check if folder already exists
    const existingObjects = await env.IMAGE_BUCKET.list({
      prefix: `${folderName}/`,
      limit: 1
    });
    
    if (existingObjects.objects && existingObjects.objects.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder already exists'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Create placeholder file to establish folder
    const placeholderKey = `${folderName}/.folder-placeholder`;
    await env.IMAGE_BUCKET.put(placeholderKey, 'This file establishes the folder structure', {
      httpMetadata: {
        contentType: 'text/plain',
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: `Folder '${folderName}' created successfully`,
      folder: {
        name: folderName,
        path: folderName
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleCreateNestedFolder(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const folderPath = body.path?.trim();
    const createParents = body.createParents !== false; // default to true
    
    if (!folderPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder path is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate and sanitize the path
    let sanitizedPath;
    try {
      sanitizedPath = validateAndSanitizePath(folderPath);
    } catch (validationError) {
      return new Response(JSON.stringify({
        success: false,
        error: validationError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (!sanitizedPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid folder path'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const segments = sanitizedPath.split('/');
    const createdPaths = [];
    
    if (createParents) {
      // Create all parent folders if they don't exist
      for (let i = 0; i < segments.length; i++) {
        const currentPath = segments.slice(0, i + 1).join('/');
        const exists = await folderExists(env, currentPath);
        
        if (!exists) {
          await createFolderPlaceholder(env, currentPath);
          createdPaths.push(currentPath);
        }
      }
    } else {
      // Only create the target folder
      const exists = await folderExists(env, sanitizedPath);
      if (exists) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Folder already exists'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      await createFolderPlaceholder(env, sanitizedPath);
      createdPaths.push(sanitizedPath);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Folder structure created successfully`,
      data: {
        path: sanitizedPath,
        createdPaths,
        totalCreated: createdPaths.length
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleMoveFolder(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const sourcePath = body.sourcePath?.trim();
    const targetPath = body.targetPath?.trim();
    const createParents = body.createParents !== false; // default to true
    
    if (!sourcePath || !targetPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Both sourcePath and targetPath are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate and sanitize paths
    let sanitizedSourcePath, sanitizedTargetPath;
    try {
      sanitizedSourcePath = validateAndSanitizePath(sourcePath);
      sanitizedTargetPath = validateAndSanitizePath(targetPath);
    } catch (validationError) {
      return new Response(JSON.stringify({
        success: false,
        error: validationError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (sanitizedSourcePath === sanitizedTargetPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source and target paths cannot be the same'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Check if source folder exists
    const sourceExists = await folderExists(env, sanitizedSourcePath);
    if (!sourceExists) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source folder not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Check if target already exists
    const targetExists = await folderExists(env, sanitizedTargetPath);
    if (targetExists) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Target folder already exists'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Create parent folders if needed
    if (createParents) {
      const targetSegments = sanitizedTargetPath.split('/');
      for (let i = 0; i < targetSegments.length - 1; i++) {
        const parentPath = targetSegments.slice(0, i + 1).join('/');
        const parentExists = await folderExists(env, parentPath);
        if (!parentExists) {
          await createFolderPlaceholder(env, parentPath);
        }
      }
    }
    
    // List all objects in the source folder (recursively)
    const objectsToMove = await env.IMAGE_BUCKET.list({
      prefix: `${sanitizedSourcePath}/`,
      limit: 1000 // TODO: Handle pagination for very large folders
    });
    
    if (!objectsToMove.objects || objectsToMove.objects.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Source folder is empty or not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let movedFiles = 0;
    let movedFolders = 0;
    const moveResults = [];
    const placeholdersSeen = new Set();
    
    // Move each object to the new location
    for (const obj of objectsToMove.objects) {
      try {
        const oldKey = obj.key;
        const relativePath = oldKey.substring(sanitizedSourcePath.length + 1);
        const newKey = `${sanitizedTargetPath}/${relativePath}`;
        
        // Track folders created during move
        if (oldKey.endsWith('/.folder-placeholder')) {
          const folderPath = oldKey.substring(0, oldKey.length - '/.folder-placeholder'.length);
          const relativeFolder = folderPath.substring(sanitizedSourcePath.length + 1);
          placeholdersSeen.add(relativeFolder);
        }
        
        // Copy object to new location
        const objectData = await env.IMAGE_BUCKET.get(oldKey);
        if (objectData) {
          await env.IMAGE_BUCKET.put(newKey, objectData.body, {
            httpMetadata: objectData.httpMetadata,
            customMetadata: {
              ...objectData.customMetadata,
              'x-moved-from': oldKey,
              'x-moved-at': new Date().toISOString()
            }
          });
          
          // Delete old object
          await env.IMAGE_BUCKET.delete(oldKey);
          
          if (oldKey.endsWith('/.folder-placeholder')) {
            movedFolders++;
          } else {
            movedFiles++;
          }
          
          moveResults.push({ 
            oldKey, 
            newKey, 
            success: true,
            type: oldKey.endsWith('/.folder-placeholder') ? 'folder' : 'file'
          });
        }
      } catch (moveError) {
        moveResults.push({ 
          oldKey: obj.key, 
          newKey: obj.key.replace(`${sanitizedSourcePath}/`, `${sanitizedTargetPath}/`), 
          success: false, 
          error: moveError.message 
        });
      }
    }
    
    // Create target folder placeholder if it doesn't exist
    const targetFolderExists = await folderExists(env, sanitizedTargetPath);
    if (!targetFolderExists) {
      await createFolderPlaceholder(env, sanitizedTargetPath);
    }
    
    const successfulMoves = moveResults.filter(r => r.success).length;
    
    return new Response(JSON.stringify({
      success: successfulMoves > 0,
      message: `Moved ${movedFiles} files and ${movedFolders} folders from '${sanitizedSourcePath}' to '${sanitizedTargetPath}'`,
      data: {
        sourcePath: sanitizedSourcePath,
        targetPath: sanitizedTargetPath,
        movedFiles,
        movedFolders,
        totalObjects: objectsToMove.objects.length,
        successfulMoves,
        failedMoves: moveResults.filter(r => !r.success).length,
        details: moveResults
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Helper functions for folder operations
async function folderExists(env, folderPath) {
  try {
    const existingObjects = await env.IMAGE_BUCKET.list({
      prefix: `${folderPath}/`,
      limit: 1
    });
    return existingObjects.objects && existingObjects.objects.length > 0;
  } catch (error) {
    return false;
  }
}

async function createFolderPlaceholder(env, folderPath) {
  const placeholderKey = `${folderPath}/.folder-placeholder`;
  await env.IMAGE_BUCKET.put(placeholderKey, 'This file maintains the folder structure', {
    httpMetadata: {
      contentType: 'text/plain',
      cacheControl: 'no-cache'
    },
    customMetadata: {
      'x-folder-placeholder': 'true',
      'x-created-at': new Date().toISOString()
    }
  });
}

async function handleRenameFolder(request, env, corsHeaders, oldFolderName) {
  try {
    const body = await request.json();
    const newFolderName = body.name?.trim();
    
    if (!newFolderName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'New folder name is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate new folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(newFolderName)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder name can only contain letters, numbers, hyphens, and underscores'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (oldFolderName === newFolderName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'New folder name must be different from current name'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Check if new folder name already exists
    const existingObjects = await env.IMAGE_BUCKET.list({
      prefix: `${newFolderName}/`,
      limit: 1
    });
    
    if (existingObjects.objects && existingObjects.objects.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'A folder with that name already exists'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // List all objects in the old folder
    const objectsToMove = await env.IMAGE_BUCKET.list({
      prefix: `${oldFolderName}/`,
      limit: 1000
    });
    
    if (!objectsToMove.objects || objectsToMove.objects.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder not found or is empty'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let movedCount = 0;
    const moveResults = [];
    
    // Move each object to the new folder
    for (const obj of objectsToMove.objects) {
      try {
        const oldKey = obj.key;
        const newKey = oldKey.replace(`${oldFolderName}/`, `${newFolderName}/`);
        
        // Copy object to new location
        const objectData = await env.IMAGE_BUCKET.get(oldKey);
        if (objectData) {
          await env.IMAGE_BUCKET.put(newKey, objectData.body, {
            httpMetadata: objectData.httpMetadata
          });
          
          // Delete old object
          await env.IMAGE_BUCKET.delete(oldKey);
          movedCount++;
          moveResults.push({ oldKey, newKey, success: true });
        }
      } catch (moveError) {
        moveResults.push({ 
          oldKey: obj.key, 
          newKey: obj.key.replace(`${oldFolderName}/`, `${newFolderName}/`), 
          success: false, 
          error: moveError.message 
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: movedCount > 0,
      message: `Moved ${movedCount} files from '${oldFolderName}' to '${newFolderName}'`,
      movedCount,
      totalFiles: objectsToMove.objects.length,
      details: moveResults
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleDeleteFolder(request, env, corsHeaders, folderName) {
  try {
    // List all objects in the folder
    const objectsToDelete = await env.IMAGE_BUCKET.list({
      prefix: `${folderName}/`,
      limit: 1000
    });
    
    if (!objectsToDelete.objects || objectsToDelete.objects.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder not found or is already empty'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let deletedCount = 0;
    const deleteResults = [];
    
    // Delete each object in the folder
    for (const obj of objectsToDelete.objects) {
      try {
        await env.IMAGE_BUCKET.delete(obj.key);
        deletedCount++;
        deleteResults.push({ key: obj.key, success: true });
      } catch (deleteError) {
        deleteResults.push({ 
          key: obj.key, 
          success: false, 
          error: deleteError.message 
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: deletedCount > 0,
      message: `Deleted ${deletedCount} files from folder '${folderName}'`,
      deletedCount,
      totalFiles: objectsToDelete.objects.length,
      details: deleteResults
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

async function handleDeleteFolderRecursive(request, env, corsHeaders, folderPath) {
  try {
    if (!folderPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder path parameter is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Validate and sanitize the folder path
    let sanitizedPath;
    try {
      sanitizedPath = validateAndSanitizePath(folderPath);
    } catch (validationError) {
      return new Response(JSON.stringify({
        success: false,
        error: validationError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (!sanitizedPath) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid folder path'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Check if folder exists
    const folderExists = await env.IMAGE_BUCKET.list({
      prefix: `${sanitizedPath}/`,
      limit: 1
    });
    
    if (!folderExists.objects || folderExists.objects.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder not found or is already empty'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // List all objects in the folder recursively
    const allObjects = [];
    let cursor = undefined;
    let hasMore = true;
    
    // Paginate through all objects to handle large folders
    while (hasMore) {
      const listResult = await env.IMAGE_BUCKET.list({
        prefix: `${sanitizedPath}/`,
        limit: 1000,
        cursor: cursor
      });
      
      if (listResult.objects && listResult.objects.length > 0) {
        allObjects.push(...listResult.objects);
      }
      
      hasMore = listResult.truncated;
      cursor = listResult.cursor;
    }
    
    if (allObjects.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Folder is empty'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let deletedFiles = 0;
    let deletedFolders = 0;
    let totalSize = 0;
    const deleteResults = [];
    const BATCH_SIZE = 50; // Delete in batches to avoid timeouts
    
    // Process objects in batches
    for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
      const batch = allObjects.slice(i, i + BATCH_SIZE);
      
      // Delete batch in parallel
      const batchPromises = batch.map(async (obj) => {
        try {
          await env.IMAGE_BUCKET.delete(obj.key);
          
          if (obj.key.endsWith('/.folder-placeholder')) {
            deletedFolders++;
          } else {
            deletedFiles++;
            totalSize += obj.size || 0;
          }
          
          return { 
            key: obj.key, 
            success: true,
            type: obj.key.endsWith('/.folder-placeholder') ? 'folder' : 'file',
            size: obj.size || 0
          };
        } catch (deleteError) {
          return { 
            key: obj.key, 
            success: false, 
            error: deleteError.message,
            type: obj.key.endsWith('/.folder-placeholder') ? 'folder' : 'file'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      deleteResults.push(...batchResults);
    }
    
    const successfulDeletes = deleteResults.filter(r => r.success).length;
    const failedDeletes = deleteResults.filter(r => !r.success).length;
    
    return new Response(JSON.stringify({
      success: successfulDeletes > 0,
      message: `Deleted ${deletedFiles} files and ${deletedFolders} folders from '${sanitizedPath}'`,
      data: {
        path: sanitizedPath,
        deletedFiles,
        deletedFolders,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        totalObjects: allObjects.length,
        successfulDeletes,
        failedDeletes,
        details: deleteResults.length > 100 ? 
          deleteResults.slice(0, 100).concat([{ summary: `... and ${deleteResults.length - 100} more items` }]) : 
          deleteResults
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}