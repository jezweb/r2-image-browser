# 📁 Folder Upload Feature Guide

## Overview

The R2 Image Browser now features a **dedicated folder upload interface** that makes uploading entire folder structures intuitive and discoverable. This guide shows you how to use the new feature.

## Key Changes

### Before (Confusing)
- Single "Upload Images" button that handled both files and folders
- No clear indication that folder upload was supported
- Users had to discover drag-and-drop functionality

### After (Clear & Intuitive)
- **Separate action cards** for "Upload Files" and "Upload Folder"
- **Dedicated modal** specifically designed for folder uploads
- **Clear instructions** and visual indicators
- **Browser compatibility warnings** when needed

## How to Upload a Folder

### Step 1: Access Admin Dashboard
Navigate to the admin dashboard where you'll see the new action cards:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Upload Files  │  │  Upload Folder  │  │  Create Folder  │  │   Bulk Delete   │
│       📄➕      │  │      📁➕       │  │      📁+        │  │       🗑️        │
│                 │  │                 │  │                 │  │   Coming soon   │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Step 2: Click "Upload Folder"
Click the **Upload Folder** card to open the dedicated folder upload modal.

### Step 3: Select or Drop Your Folder

#### Option A: Click to Browse
1. Click the "Select Folder" button
2. Your file browser will open
3. Navigate to and select the folder you want to upload
4. Click "Select" or "Choose"

#### Option B: Drag and Drop
1. Open your file manager
2. Drag the folder you want to upload
3. Drop it onto the designated drop zone
4. The zone will highlight when hovering

### Step 4: Preview Your Upload
After selecting a folder, you'll see:
- **Tree structure preview** of all files and folders
- **File count** for each folder
- **Total number of files** to be uploaded

Example preview:
```
📁 My Photos (25 files)
├── 📁 2024 (15 files)
│   ├── 📁 January (5 files)
│   ├── 📁 February (5 files)
│   └── 📁 March (5 files)
└── 📁 2023 (10 files)
    ├── 📁 Summer (6 files)
    └── 📁 Winter (4 files)
```

### Step 5: Configure Upload Options

#### Upload Location
- **Root folder**: Upload to the top level
- **Custom folder**: Specify a parent folder (e.g., "categories/2024")

#### Conflict Resolution
Choose what happens if files already exist:
- **Rename**: Add numbers to duplicate filenames (file-1.jpg, file-2.jpg)
- **Skip**: Don't upload files that already exist
- **Overwrite**: Replace existing files

### Step 6: Start Upload
Click the "Upload" button to begin. You'll see:
- Progress bar showing overall completion
- Current file being uploaded
- Count of completed files

## Browser Compatibility

### ✅ Fully Supported Browsers
- Google Chrome (recommended)
- Microsoft Edge
- Opera

### ⚠️ Limited Support
- Firefox: Use file upload instead
- Safari: Use file upload instead

### ❌ Not Supported
- Internet Explorer
- Mobile browsers

If your browser isn't supported, the modal will:
1. Show a clear warning message
2. Provide download links for compatible browsers
3. Offer to switch to file upload mode

## Tips for Best Results

### 1. Organize Before Uploading
Structure your folders locally before uploading:
```
photos/
├── products/
│   ├── electronics/
│   └── clothing/
├── team/
└── events/
```

### 2. Use Descriptive Folder Names
- ✅ Good: "2024-january-product-launch"
- ❌ Avoid: "folder1", "new", "untitled"

### 3. Check File Types
Only image files are uploaded:
- ✅ Supported: .jpg, .jpeg, .png, .gif, .svg, .webp
- ❌ Ignored: .txt, .doc, .pdf, etc.

### 4. Watch File Sizes
- Maximum file size: 10MB per image
- Large folders may take time to process

## Troubleshooting

### "I don't see the folder upload option"
- Make sure you're in the admin dashboard
- Check that JavaScript is enabled
- Try refreshing the page

### "My folder won't upload"
- Ensure you're using a compatible browser
- Check that the folder contains image files
- Verify no individual file exceeds 10MB

### "The upload is stuck"
- Check your internet connection
- For large folders, be patient
- Try uploading smaller batches

### "Some files were skipped"
- Non-image files are automatically skipped
- Files over 10MB are skipped
- Check the upload report for details

## Example Workflow

### Uploading Product Images
1. Organize products into folders:
   ```
   products/
   ├── shoes/
   │   ├── sneakers/
   │   └── boots/
   └── accessories/
       ├── bags/
       └── watches/
   ```

2. Click "Upload Folder" in admin dashboard
3. Select the "products" folder
4. Preview shows all subfolders and file counts
5. Choose "Upload to: Custom folder" → "catalog/2024"
6. Set conflicts to "Skip existing files"
7. Click Upload
8. Result: All products uploaded to "catalog/2024/products/..."

## Benefits of Separate Upload Features

### Upload Files (for individual images)
- Quick single or multi-file uploads
- No folder structure needed
- Best for: Adding individual images

### Upload Folder (for organized collections)
- Preserves folder hierarchy
- Batch processes entire structures
- Best for: Importing organized image libraries

## Next Steps

After uploading folders:
1. Use the folder navigator to browse your structure
2. Access images via their folder paths
3. Share folder-specific URLs
4. Manage permissions by folder

---

## Quick Reference

| Feature | File Upload | Folder Upload |
|---------|------------|---------------|
| Icon | 📄 | 📁 |
| Purpose | Individual files | Entire folders |
| Structure | Flat | Hierarchical |
| Best for | Quick additions | Bulk imports |
| Drag & Drop | Files only | Folders only |
| Browser Support | All browsers | Modern only |

Need more help? Contact support or check the full documentation.