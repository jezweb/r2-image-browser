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

async function extractFilesFromObjects(objects, parentPath) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  
  return objects
    .filter(obj => 
      // Must be an image file
      imageExtensions.some(ext => obj.key.toLowerCase().endsWith(ext)) &&
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
    if (obj.key.endsWith('/.folder-placeholder')) {
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

export {
  validateAndSanitizePath,
  extractFilesFromObjects,
  buildFolderHierarchy,
  getContentTypeFromExtension
};