const express = require("express");
const multer = require("multer");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Directories
const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");

// Ensure directories exist
[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// **1️⃣ Ensure Python Environment**
function setupPythonEnv() {
    console.log("🔍 Checking Python virtual environment...");
    if (!fs.existsSync(VENV_DIR)) {
        console.log("🚀 Creating Python virtual environment...");
        execSync(`python3 -m venv ${VENV_DIR}`);
    }

    console.log("⚡ Installing dependencies...");
    execSync(`${VENV_DIR}/bin/pip install --upgrade pip setuptools wheel`, { stdio: "inherit" });

    if (!fs.existsSync("requirements.txt")) {
        console.log("⚠️ `requirements.txt` not found! Creating a new one...");
        fs.writeFileSync("requirements.txt", "torch\ntorchaudio\ndemucs\nnumpy\nffmpeg-python\n");
    }

    execSync(`${VENV_DIR}/bin/pip install -r requirements.txt`, { stdio: "inherit" });
    console.log("✅ Python environment ready!");
}

// **2️⃣ File Upload Handling**
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// **3️⃣ Process Audio with Demucs**
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = path.join(UPLOADS_DIR, req.file.filename);
    const outputPath = OUTPUTS_DIR;
    
    console.log(`🎵 Processing file: ${inputPath}`);

    try {
        execSync(`${VENV_DIR}/bin/demucs --two-stems=vocals --no-cuda -o ${outputPath} ${inputPath}`, { stdio: "inherit" });
        
        const resultDir = fs.readdirSync(outputPath)[0]; // Get folder name
        const vocalsPath = path.join(outputPath, resultDir, "vocals.wav");
        const instrumentalPath = path.join(outputPath, resultDir, "no_vocals.wav");

        res.json({
            message: "✅ Separation complete!",
            vocals: `/outputs/${path.basename(vocalsPath)}`,
            instrumental: `/outputs/${path.basename(instrumentalPath)}`,
        });

    } catch (error) {
        console.error("🚨 Separation failed:", error);
        res.status(500).json({ error: "Failed to separate vocals" });
    }
});

// **4️⃣ Serve Output Files**
app.use("/outputs", express.static(OUTPUTS_DIR));

// **5️⃣ Start Server**
setupPythonEnv(); // Ensure dependencies are installed
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
