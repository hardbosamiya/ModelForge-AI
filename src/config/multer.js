import multer from "multer";

// Use memory storage so req.file.buffer is available. The upload flow
// forwards req.file.buffer to the Django ML service (see
// DjangoDatasetService.uploadDataset), which requires the in-memory buffer
// rather than a file written to disk.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 104857600,
  },
});

export default upload;