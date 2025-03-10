const express = require("express");
const multer = require("multer"); // needed for file uploads
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);

// Serve outputs statically
app.use("/outputs", express.static(OUTPUTS_DIR));

// 1) Python environment setup
function setupPythonEnv() {
  console.log("🔍 Checking Python venv...");
  if (!fs.existsSync(VENV_DIR)) {
    console.log("🚀 Creating Python venv...");
    execSync(`python3 -m venv ${VENV_DIR}`);
  }

  console.log("⚡ Installing Python deps...");
  execSync(`${VENV_DIR}/bin/pip install --upgrade pip setuptools wheel`, { stdio: "inherit" });

  // Create requirements if missing
  if (!fs.existsSync("requirements.txt")) {
    fs.writeFileSync("requirements.txt", `
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.0.0+cpu
torchaudio==2.0.0+cpu
demucs==4.0.1
numpy
ffmpeg-python
`.trim());
  }

  execSync(`${VENV_DIR}/bin/pip install -r requirements.txt`, { stdio: "inherit" });
  console.log("✅ CPU Demucs env ready.");
}

// 2) Basic root route
app.get("/", (req, res) => {
  res.send("🎶 CPU Demucs server running!");
});

// 3) Configure Multer to handle file uploads
const upload = multer({
  dest: "uploads/"
});

// 4) POST /upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  // If no file
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // Full path to the uploaded file
  const inputFilePath = path.join(__dirname, req.file.path);
  console.log("🎵 Received file:", inputFilePath);

  try {
    // Run Demucs in CPU mode
    execSync(`${VENV_DIR}/bin/demucs --two-stems=vocals --no-cuda -o ${OUTPUTS_DIR} "${inputFilePath}"`, {
      stdio: "inherit"
    });

    // demucs creates subfolder(s) in outputs/
    const folders = fs.readdirSync(OUTPUTS_DIR).filter(f => {
      return fs.statSync(path.join(OUTPUTS_DIR, f)).isDirectory();
    });

    if (!folders.length) {
      return res.status(500).json({ error: "Demucs output folder not found." });
    }

    // If multiple subfolders, pick the latest
    const latestFolder = folders.sort((a, b) => {
      const atime = fs.statSync(path.join(OUTPUTS_DIR, a)).mtime;
      const btime = fs.statSync(path.join(OUTPUTS_DIR, b)).mtime;
      return btime - atime; // desc
    })[0];

    // Paths to the separated files
    const vocalsPath = `/outputs/${latestFolder}/vocals.wav`;
    const noVocalsPath = `/outputs/${latestFolder}/no_vocals.wav`;

    // Return URLs so the client can download them
    res.json({
      message: "✅ Separation complete!",
      vocals: vocalsPath,
      instrumental: noVocalsPath
    });
  } catch (error) {
    console.error("Demucs error:", error);
    res.status(500).json({ error: "Failed to separate track" });
  }
});

// 5) Start server
setupPythonEnv();
app.listen(PORT, () => {
  console.log(`🚀 CPU Demucs server on port ${PORT}`);
});
