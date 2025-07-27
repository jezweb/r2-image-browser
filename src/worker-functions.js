// Extract worker functions for testing
// This file contains the core logic from the Cloudflare Worker

export function validateAndSanitizePath(path) {
  if (!path) return path;
  
  // Check for path traversal
  if (path.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  // Check for double slashes
  if (path.includes('//')) {
    throw new Error('Double slashes not allowed');
  }
  
  // Check for invalid characters
  if (/[\x00-\x1f\x7f-\x9f]/.test(path)) {
    throw new Error('Invalid characters in path');
  }
  
  // Check length
  if (path.length > 1024) {
    throw new Error('Path too long');
  }
  
  return path;
}

export function buildFolderHierarchy(files, basePath = '') {
  const folderMap = new Map();
  const processedFiles = files.map(file => ({
    ...file,
    relativePath: file.key.startsWith(basePath) ? file.key.slice(basePath.length) : file.key
  }));
  
  // Build folder structure
  processedFiles.forEach(file => {
    const pathParts = file.relativePath.split('/');
    
    // Skip if it's just a filename (no folders)
    if (pathParts.length <= 1) return;
    
    let currentPath = '';
    for (let i = 0; i < pathParts.length - 1; i++) {
      const folderName = pathParts[i];
      const previousPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, {
          name: folderName,
          path: basePath ? `${basePath}/${currentPath}` : currentPath,
          type: 'folder',
          children: [],
          fileCount: 0,
          parent: previousPath || null
        });
      }
    }
  });
  
  // Count files in each folder
  processedFiles.forEach(file => {
    const pathParts = file.relativePath.split('/');
    if (pathParts.length > 1) {
      let currentPath = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${pathParts[i]}` : pathParts[i];
        const folder = folderMap.get(currentPath);
        if (folder) {
          folder.fileCount++;
        }
      }
    }
  });
  
  // Build hierarchy
  const rootFolders = [];
  const sortedPaths = Array.from(folderMap.keys()).sort();
  
  sortedPaths.forEach(path => {
    const folder = folderMap.get(path);
    if (folder.parent) {
      const parent = folderMap.get(folder.parent);
      if (parent) {
        parent.children.push(folder);
      }
    } else {
      rootFolders.push(folder);
    }
  });
  
  // Sort root folders and all children by name
  const sortFolders = (folders) => {
    folders.sort((a, b) => a.name.localeCompare(b.name));
    folders.forEach(folder => {
      if (folder.children && folder.children.length > 0) {
        sortFolders(folder.children);
      }
    });
  };
  
  sortFolders(rootFolders);
  return rootFolders;
}

export async function handleListFolders(env, corsHeaders, request) {
  try {
    const url = new URL(request.url);
    const path = validateAndSanitizePath(url.searchParams.get('path') || '');
    const depth = parseInt(url.searchParams.get('depth') || '1');
    const includeFiles = url.searchParams.get('include_files') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const cursor = url.searchParams.get('cursor');
    
    const prefix = path ? `${path}/` : '';
    const listOptions = {
      prefix,
      delimiter: depth === 1 ? '/' : undefined,
      limit,
      cursor
    };
    
    const result = await env.R2_BUCKET.list(listOptions);
    
    // Build folders from delimited prefixes
    const folders = [];
    if (result.delimitedPrefixes) {
      for (const prefixObj of result.delimitedPrefixes) {
        const folderPath = prefixObj.prefix.slice(0, -1); // Remove trailing slash
        const folderName = folderPath.split('/').pop();
        
        folders.push({
          name: folderName,
          path: folderPath,
          type: 'folder'
        });
      }
    }
    
    // For deeper hierarchies, build nested structure
    if (depth > 1) {
      const allFiles = [];
      let hasMore = true;
      let nextCursor = cursor;
      
      while (hasMore && allFiles.length < 10000) { // Safety limit
        const deepResult = await env.R2_BUCKET.list({
          prefix,
          limit: 1000,
          cursor: nextCursor
        });
        
        allFiles.push(...deepResult.objects);
        hasMore = deepResult.truncated;
        nextCursor = deepResult.cursor;
      }
      
      const hierarchy = buildFolderHierarchy(allFiles, path);
      return new Response(JSON.stringify({
        success: true,
        data: {
          folders: hierarchy,
          files: includeFiles ? result.objects.map(obj => ({
            name: obj.key.split('/').pop(),
            path: obj.key,
            size: obj.size,
            lastModified: obj.uploaded,
            url: `https://your-domain.com/${obj.key}`
          })) : undefined,
          pagination: {
            hasMore: result.truncated,
            cursor: result.cursor
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Simple folder listing
    const responseData = {
      folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
      pagination: {
        hasMore: result.truncated,
        cursor: result.cursor
      }
    };
    
    if (includeFiles) {
      responseData.files = result.objects.map(obj => ({
        name: obj.key.split('/').pop(),
        path: obj.key,
        size: obj.size,
        lastModified: obj.uploaded,
        url: `https://your-domain.com/${obj.key}`
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: responseData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function processUploadedFile(env, file, targetPath, conflictResolution) {
  try {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        status: 'failed',
        originalName: file.name,
        error: 'Invalid file type. Only images are allowed.'
      };
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return {
        status: 'failed',
        originalName: file.name,
        error: 'File too large. Maximum size is 10MB.'
      };
    }
    
    // Sanitize target path
    const sanitizedPath = targetPath.replace(/[^a-zA-Z0-9\-_./]/g, '_').replace(/\.+/g, '.');
    let finalPath = sanitizedPath;
    
    // Handle conflicts
    if (conflictResolution !== 'overwrite') {
      const existingFile = await env.R2_BUCKET.get(finalPath);
      
      if (existingFile) {
        if (conflictResolution === 'skip') {
          return {
            status: 'skipped',
            originalName: file.name,
            finalPath: finalPath,
            note: 'File already exists and was skipped'
          };
        } else if (conflictResolution === 'rename') {
          const pathParts = finalPath.split('.');
          const extension = pathParts.length > 1 ? pathParts.pop() : '';
          const baseName = pathParts.join('.');
          
          let counter = 1;
          let newPath;
          do {
            newPath = extension ? `${baseName}-${counter}.${extension}` : `${baseName}-${counter}`;
            const check = await env.R2_BUCKET.get(newPath);
            if (!check) {
              finalPath = newPath;
              break;
            }
            counter++;
          } while (counter < 1000); // Safety limit
        }
      }
    }
    
    // Upload file
    const fileContent = await file.arrayBuffer();
    const uploadResult = await env.R2_BUCKET.put(finalPath, fileContent, {
      metadata: {
        originalName: file.name,
        contentType: file.type,
        uploadDate: new Date().toISOString()
      }
    });
    
    const note = conflictResolution === 'overwrite' && finalPath === sanitizedPath ? 
      'File was overwritten' : 
      (finalPath !== sanitizedPath ? 'File was renamed to avoid conflict' : undefined);
    
    return {
      status: 'success',
      originalName: file.name,
      finalPath: finalPath,
      size: file.size,
      url: `https://your-domain.com/${finalPath}`,
      etag: uploadResult.etag,
      note
    };
    
  } catch (error) {
    return {
      status: 'failed',
      originalName: file.name,
      error: error.message
    };
  }
}

export async function handleBatchUpload(env, corsHeaders, request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll ? formData.getAll('files') : [];
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No files provided'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const folderStructureStr = formData.get('folderStructure');
    const targetPath = formData.get('targetPath');
    const conflictResolution = formData.get('conflictResolution') || 'rename';
    
    let folderStructure = {};
    if (folderStructureStr) {
      try {
        folderStructure = JSON.parse(folderStructureStr);
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid folder structure JSON'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }
    
    // Process all files
    const results = [];
    
    for (const file of files) {
      const relativePath = folderStructure[file.name] || file.name;
      const fullPath = targetPath ? `${targetPath}/${relativePath}` : relativePath;
      
      const result = await processUploadedFile(env, file, fullPath, conflictResolution);
      results.push(result);
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          skipped: results.filter(r => r.status === 'skipped').length
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}