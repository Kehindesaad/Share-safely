const express = require("express");
const multer = require("multer");
const { BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions } = require("@azure/storage-blob");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Check if the connection string is defined
if (!connectionString) {
  console.error("AZURE_STORAGE_CONNECTION_STRING is not set");
  process.exit(1); // Exit the process if the connection string is missing
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerName = "fileuploads";
const containerClient = blobServiceClient.getContainerClient(containerName);

const app = express();
const upload = multer({ dest: "uploads/" });

// Serve static files from the public directory
app.use(express.static("public"));

// Basic GET route for the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route to upload files
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileName = req.file.filename + path.extname(req.file.originalname);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    // Upload the file to Azure Blob Storage
    await blockBlobClient.uploadFile(req.file.path);

    // Generate a time-limited SAS link
    const sasUrl = generateSASUrl(blockBlobClient, fileName);
    res.status(200).json({ message: "File uploaded successfully", link: sasUrl });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).send("Error uploading file");
  }
});

// Generate a SAS token for the blob
function generateSASUrl(blobClient, blobName) {
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setMinutes(startDate.getMinutes() + 10); // Link valid for 10 minutes

  const sasToken = generateBlobSASQueryParameters({
    containerName: containerClient.containerName,
    blobName: blobName,
    permissions: ContainerSASPermissions.parse("r"), // Read permission
    startsOn: startDate,
    expiresOn: expiryDate,
  }, blobClient.credential).toString();

  return `${blobClient.url}?${sasToken}`;
}

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
