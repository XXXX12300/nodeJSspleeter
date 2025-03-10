const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Folders
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);

// Serve output folder
app.use("/outputs", express.static(OUTPUTS_DIR));

// 1) Setup Python (CPU-Only)
function setupPythonEnv() {
  console.log("🔍 Checking Python venv...");
  if (!fs.existsSync(VENV_DIR)) {
    console.log("🚀 Creating Python venv...");
    execSync(`python3 -m venv ${VENV_DIR}`);
  }

  console.log("⚡ Installing Python deps...");
  execSync(`${VENV_DIR}/bin/pip install --upgrade pip setuptools wheel`, { stdio: "inherit" });

  // Ensure requirements.txt is present
  if (!fs.existsSync("requirements.txt")) {
    console.log("⚠️ No requirements.txt found. Creating one...");
    fs.writeFileSync("requirements.txt", `
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.0.0+cpu
torchaudio==2.0.0+cpu
demucs==4.0.1
numpy
ffmpeg-python
`.trim());
  }

  // Install CPU-only Torch, Torchaudio, and Demucs
  execSync(`${VENV_DIR}/bin/pip install -r requirements.txt`, { stdio: "inherit" });
  console.log("✅ Python environment ready (CPU-only).");
}

// 2) Simple test route
app.get("/", (req, res) => {
  res.send("🎶 CPU Demucs server running!");
});

// 3) Trigger separation route
app.get("/separate", async (req, res) => {
  try {
    // For demonstration, you can run demucs on "example.mp3" if present
    if (!fs.existsSync("example.mp3")) {
      return res.json({ message: "No example.mp3 found in root." });
    }
    console.log("🎵 Running Demucs CPU...");
    execSync(`${VENV_DIR}/bin/demucs --two-stems=vocals --no-cuda -o ${OUTPUTS_DIR} example.mp3`, { stdio: "inherit" });

    // Suppose demucs writes to a subfolder in outputs/
    const folders = fs.readdirSync(OUTPUTS_DIR).filter(f => fs.statSync(path.join(OUTPUTS_DIR, f)).isDirectory());
    if (!folders.length) {
      return res.json({ error: "No demucs output folder found." });
    }
    const resultFolder = path.join(OUTPUTS_DIR, folders[0]);
    const vocalsPath = path.join(resultFolder, "vocals.wav");
    const noVocalsPath = path.join(resultFolder, "no_vocals.wav");

    res.json({
      message: "Separation complete",
      vocals: `/outputs/${folders[0]}/vocals.wav`,
      instrumental: `/outputs/${folders[0]}/no_vocals.wav`
    });
  } catch (err) {
    console.error("Demucs error:", err);
    res.status(500).json({ error: "Failed to separate track." });
  }
});

// 4) Start server
setupPythonEnv();
app.listen(PORT, () => {
  console.log(`🚀 CPU Demucs server on port ${PORT}`);
});
