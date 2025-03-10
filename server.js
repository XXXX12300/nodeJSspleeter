const express = require("express");
const multer = require("multer");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Folders
const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");

// Ensure folders exist
[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Setup file upload storage (temp folder)
const upload = multer({ dest: UPLOADS_DIR });

// 🔍 Setup Python (CPU-only)
function setupPythonEnv() {
    console.log("🔍 Checking Python venv...");
    if (!fs.existsSync(VENV_DIR)) {
        console.log("🚀 Creating Python venv...");
        execSync(`python3 -m venv ${VENV_DIR}`);
    }

    console.log("⚡ Installing Python dependencies...");
    execSync(`${VENV_DIR}/bin/pip install --upgrade pip setuptools wheel`, { stdio: "inherit" });

    // Ensure requirements.txt exists
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

    // Install dependencies
    execSync(`${VENV_DIR}/bin/pip install -r requirements.txt`, { stdio: "inherit" });
    console.log("✅ Python environment ready.");
}

// 🌎 Serve output files for download
app.use("/outputs", express.static(OUTPUTS_DIR));

// 🚀 Test route
app.get("/", (req, res) => {
    res.send("🎶 Demucs Vocal Remover API is running!");
});

// 🔄 Upload & Process Audio
app.post("/upload", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const inputFile = req.file.path;
        console.log(`🎵 Received file: ${inputFile}`);

        // Run Demucs for vocal separation
        execSync(`${VENV_DIR}/bin/demucs --two-stems=vocals --no-cuda -o ${OUTPUTS_DIR} ${inputFile}`, { stdio: "inherit" });

        // Find the output folder
        const outputFolders = fs.readdirSync(OUTPUTS_DIR).filter(f => fs.statSync(path.join(OUTPUTS_DIR, f)).isDirectory());
        if (!outputFolders.length) {
            return res.status(500).json({ error: "Separation failed." });
        }

        const resultFolder = path.join(OUTPUTS_DIR, outputFolders[0]);
        const vocalsFile = path.join(resultFolder, "vocals.wav");
        const instrumentalFile = path.join(resultFolder, "no_vocals.wav");

        // Read files and convert to base64 for client download
        const vocalsData = fs.readFileSync(vocalsFile).toString("base64");
        const instrumentalData = fs.readFileSync(instrumentalFile).toString("base64");

        // Delete files after sending response
        setTimeout(() => {
            try {
                fs.rmSync(resultFolder, { recursive: true, force: true });
                fs.unlinkSync(inputFile);
                console.log("🗑️ Deleted processed files.");
            } catch (err) {
                console.error("Error deleting files:", err);
            }
        }, 5000); // Delay to ensure client receives data

        res.json({
            message: "Separation complete",
            vocals: vocalsData,
            instrumental: instrumentalData,
            format: "base64"
        });

    } catch (error) {
        console.error("❌ Processing error:", error);
        res.status(500).json({ error: "Error processing file." });
    }
});

// 🚀 Start Server
setupPythonEnv();
app.listen(PORT, () => {
    console.log(`🎧 Server running on port ${PORT}`);
});
