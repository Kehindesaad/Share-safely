// server.js (with SAS URL generation)
const express = require('express');
const multer = require('multer');
const path = require('path');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Initialize BlobServiceClient using Account Name and Key
const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  new StorageSharedKeyCredential(process.env.AZURE_STORAGE_ACCOUNT_NAME, process.env.AZURE_STORAGE_ACCOUNT_KEY)
);

// Middleware to serve static files (for the frontend)
app.use(express.static('public'));

// Handle file upload
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    // Get the file info and create a blob client
    const blobName = uuidv4() + path.extname(req.file.originalname); // generate unique name
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload the file to Azure Blob Storage
    await blockBlobClient.uploadFile(req.file.path);
    console.log(`Upload successful: ${blobName}`);

    // Generate a SAS URL for the uploaded file (valid for 1 hour)
    const sasToken = generateBlobSASQueryParameters({
      containerName: process.env.AZURE_CONTAINER_NAME,
      blobName: blobName,
      permissions: BlobSASPermissions.parse('r'), // Read permission
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour from now
    }, new StorageSharedKeyCredential(process.env.AZURE_STORAGE_ACCOUNT_NAME, process.env.AZURE_STORAGE_ACCOUNT_KEY)).toString();

    const sasUrl = `${blockBlobClient.url}?${sasToken}`;

    // Respond with the SAS URL
    res.send(`File uploaded successfully! Access your file at: ${sasUrl}`);
  } catch (error) {
    console.error('Error uploading file to Azure Blob:', error);
    res.status(500).send('Failed to upload file to Azure Blob Storage.');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
