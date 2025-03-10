const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Spleeter } = require("spleeter-node");

const app = express();
const PORT = process.env.PORT || 3000;

// Upload folder setup
const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");

// Ensure directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Route to check API status
app.get("/", (req, res) => {
  res.send("🎶 Spleeter Vocal Remover API is running!");
});

// Upload and process audio
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded!" });
    }

    const inputFilePath = req.file.path;
    const outputPath = path.join(OUTPUT_DIR, req.file.filename);

    // Use Spleeter to separate vocals and instrumental
    const spleeter = new Spleeter();
    await spleeter.separate(inputFilePath, outputPath, "2stems"); // "2stems" for vocals/instrumental

    // Return file paths for download
    res.json({
      file_id: req.file.filename,
      vocals: `/download/${req.file.filename}/vocals.wav`,
      instrumental: `/download/${req.file.filename}/accompaniment.wav`
    });

  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({ error: "Audio processing failed!" });
  }
});

// Serve processed files
app.get("/download/:file_id/:type", (req, res) => {
  const { file_id, type } = req.params;
  const filePath = path.join(OUTPUT_DIR, file_id, `${type}.wav`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found!" });
  }

  res.download(filePath);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
