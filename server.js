const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("🎶 Spleeter Vocal Remover API is running!");
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded!" });
    }

    const inputFilePath = req.file.path;
    const outputPath = path.join(OUTPUT_DIR, req.file.filename);

    // Run Spleeter in Python
    const spleeterCommand = `spleeter separate -o ${OUTPUT_DIR} -p spleeter:2stems ${inputFilePath}`;
    exec(spleeterCommand, (error, stdout, stderr) => {
      if (error) {
        console.error("Spleeter error:", stderr);
        return res.status(500).json({ error: "Audio processing failed!" });
      }

      res.json({
        file_id: req.file.filename,
        vocals: `/download/${req.file.filename}/vocals.wav`,
        instrumental: `/download/${req.file.filename}/accompaniment.wav`
      });
    });

  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({ error: "Audio processing failed!" });
  }
});

app.get("/download/:file_id/:type", (req, res) => {
  const { file_id, type } = req.params;
  const filePath = path.join(OUTPUT_DIR, file_id, `${type}.wav`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found!" });
  }

  res.download(filePath);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
