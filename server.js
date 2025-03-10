const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);
app.use("/outputs", express.static(OUTPUTS_DIR));

// 1️⃣ Setup Python (CPU-only)
function setupPythonEnv() {
  console.log("🔍 Checking Python venv...");
  if (!fs.existsSync(VENV_DIR)) {
    console.log("🚀 Creating Python venv...");
    execSync(`python3 -m venv ${VENV_DIR}`);
  }

  console.log("⚡ Installing Python deps...");
  execSync(`${VENV_DIR}/bin/pip install --upgrade pip setuptools wheel`, { stdio: "inherit" });
  if (!fs.existsSync("requirements.txt")) {
    console.log("⚠️ No requirements.txt found. Creating one...");
    fs.writeFileSync("requirements.txt", `
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.0.1+cpu
torchaudio==2.0.1+cpu
demucs
numpy
ffmpeg-python
`.trim());
  }

  // Install CPU-only Torch & Demucs
  execSync(`${VENV_DIR}/bin/pip install -r requirements.txt`, { stdio: "inherit" });
  console.log("✅ Python env ready (CPU-only Demucs).");
}

// 2️⃣ Test Route: Runs Demucs
app.get("/test", (req, res) => {
  try {
    // We'll separate a sample file "example.mp3"
    // (In real usage, you can upload a file or so)
    if (!fs.existsSync("example.mp3")) {
      return res.json({ message: "No example.mp3 file found." });
    }

    console.log("🎵 Running Demucs CPU...");
    execSync(`${VENV_DIR}/bin/demucs --two-stems=vocals --no-cuda -o ${OUTPUTS_DIR} example.mp3`, { stdio: "inherit" });

    // Suppose Demucs created a folder in outputs/ called "example"
    const folders = fs.readdirSync(OUTPUTS_DIR).filter(f => fs.statSync(path.join(OUTPUTS_DIR, f)).isDirectory());
    if (!folders.length) {
      return res.json({ error: "No demucs output folder found." });
    }
    const resultFolder = path.join(OUTPUTS_DIR, folders[0]);
    const vocalsPath = path.join(resultFolder, "vocals.wav");
    const noVocalsPath = path.join(resultFolder, "no_vocals.wav");

    res.json({
      message: "Separation complete (CPU-only).",
      vocals: `/outputs/${folders[0]}/vocals.wav`,
      instrumental: `/outputs/${folders[0]}/no_vocals.wav`
    });

  } catch (err) {
    console.error("Demucs error:", err);
    res.status(500).json({ error: "Failed to separate track." });
  }
});

// 3️⃣ Start Server
setupPythonEnv(); // do the pip install
app.listen(PORT, () => {
  console.log(`🚀 CPU-based Demucs server on port ${PORT}`);
});
