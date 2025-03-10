const express = require("express");
const multer = require("multer");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Ensure required dependencies are installed
function installMissingDependencies() {
    console.log("🔍 Checking dependencies...");

    try {
        execSync("spleeter -h", { stdio: "ignore" });
        console.log("✅ Spleeter is installed.");
    } catch {
        console.log("🚀 Installing Spleeter...");
        execSync("pip install spleeter", { stdio: "inherit" });
    }

    try {
        require.resolve("onnxruntime-node");
        console.log("✅ ONNX Runtime Node is installed.");
    } catch {
        console.log("🚀 Installing ONNX Runtime Node...");
        execSync("npm install onnxruntime-node", { stdio: "inherit" });
    }
}

// Run installation check before starting the server
installMissingDependencies();

const app = express();
const PORT = process.env.PORT || 10000;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const MODEL_PATH = path.join(__dirname, "VocRem/UVR_MDXNET_Main.onnx");

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);

// Middleware for parsing requests
app.use(express.json());

// Configure file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// **1️⃣ Upload and process audio file**
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputFilePath = req.file.path;
    const outputVocals = path.join(OUTPUTS_DIR, req.file.filename + "_vocals.wav");
    const outputInstrumental = path.join(OUTPUTS_DIR, req.file.filename + "_instrumental.wav");

    console.log(`🎶 Processing file: ${inputFilePath}`);

    try {
        // Run Spleeter for vocal separation
        execSync(`spleeter separate -o ${OUTPUTS_DIR} -p spleeter:2stems ${inputFilePath}`, { stdio: "inherit" });

        // Send the results back to the client
        res.json({
            message: "Processing complete",
            vocals: `/download/${req.file.filename}_vocals.wav`,
            instrumental: `/download/${req.file.filename}_instrumental.wav`,
        });
    } catch (error) {
        console.error("❌ Spleeter error:", error);
        res.status(500).json({ error: "Failed to process file" });
    }
});

// **2️⃣ Serve processed files**
app.get("/download/:filename", (req, res) => {
    const filePath = path.join(OUTPUTS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// **3️⃣ Check if the ONNX model is available**
app.get("/check-model", (req, res) => {
    if (fs.existsSync(MODEL_PATH)) {
        res.json({ status: "Model is available" });
    } else {
        res.status(404).json({ error: "Model not found. Please upload it to VocRem folder." });
    }
});

// **4️⃣ Start the server**
app.listen(PORT, () => {
    console.log(`🚀 Vocal Remover API running on port ${PORT}`);
});
