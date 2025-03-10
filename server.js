const express = require("express");
const multer = require("multer");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const VENV_DIR = path.join(__dirname, "venv");

// Ensure directories exist
[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// **1️⃣ Setup Python Virtual Environment & Install Dependencies**
function setupPythonEnv() {
    console.log("🔍 Checking Python virtual environment...");

    if (!fs.existsSync(VENV_DIR)) {
        console.log("🚀 Creating Python virtual environment...");
        execSync("python3 -m venv venv", { stdio: "inherit" });
    }

    console.log("⚡ Upgrading pip, setuptools, and wheel...");
    execSync(`${path.join(VENV_DIR, "bin", "pip")} install --upgrade pip setuptools wheel`, { stdio: "inherit" });

    console.log("📦 Installing required dependencies...");
    try {
        execSync(`${path.join(VENV_DIR, "bin", "pip")} install numpy==1.21.6 spleeter`, { stdio: "inherit" });
    } catch (err) {
        console.log("⚠️ NumPy 1.21.6 failed, switching to latest stable version...");
        execSync(`${path.join(VENV_DIR, "bin", "pip")} install numpy --no-build-isolation`, { stdio: "inherit" });
        execSync(`${path.join(VENV_DIR, "bin", "pip")} install spleeter`, { stdio: "inherit" });
    }

    console.log("✅ Spleeter is ready to use.");
}

// **2️⃣ Configure Multer for File Uploads**
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// **3️⃣ Upload & Process Audio File**
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputFilePath = req.file.path;
    const outputPath = path.join(OUTPUTS_DIR, req.file.filename);

    console.log(`🎶 Processing file: ${inputFilePath}`);

    try {
        execSync(`${path.join(VENV_DIR, "bin", "spleeter")} separate -o ${OUTPUTS_DIR} -p spleeter:2stems ${inputFilePath}`, { stdio: "inherit" });

        res.json({
            message: "Processing complete",
            vocals: `/download/${req.file.filename}/vocals.wav`,
            instrumental: `/download/${req.file.filename}/accompaniment.wav`,
        });
    } catch (error) {
        console.error("❌ Error during processing:", error);
        res.status(500).json({ error: "Failed to process file" });
    }
});

// **4️⃣ Serve Processed Files**
app.get("/download/:file/:type", (req, res) => {
    const { file, type } = req.params;
    const filePath = path.join(OUTPUTS_DIR, file, `${type}.wav`);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// **5️⃣ Start Server After Setup**
(async () => {
    setupPythonEnv();

    app.listen(PORT, () => {
        console.log(`🚀 Vocal Remover API running on port ${PORT}`);
    });
})();
