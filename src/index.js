export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers for API responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (url.pathname === '/api/folders') {
      return handleListFolders(env, corsHeaders);
    }
    
    if (url.pathname === '/api/images') {
      const folder = url.searchParams.get('folder');
      return handleListImages(env, folder, corsHeaders);
    }

    // Serve static assets (Vue app)
    return env.ASSETS.fetch(request);
  },
};

async function handleListFolders(env, corsHeaders) {
  try {
    // List all objects to extract unique folders
    const listed = await env.IMAGE_BUCKET.list({
      limit: 1000,
      delimiter: '/',
    });

    const folders = (listed.delimitedPrefixes || [])
      .filter(prefix => !prefix.startsWith('.thumb/')) // Exclude .thumb directory
      .map(prefix => ({
        name: prefix.replace(/\/$/, ''),
        path: prefix.replace(/\/$/, '') // Remove trailing slash for consistency
      }));
    
    return new Response(JSON.stringify({
      success: true,
      folders
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