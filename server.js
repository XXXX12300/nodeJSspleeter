const express = require("express");
const multer = require("multer");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 10000;

// Define directories
const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUTS_DIR = path.join(__dirname, "outputs");
const MODEL_DIR = path.join(__dirname, "VocRem");
const MODEL_PATH = path.join(MODEL_DIR, "UVR_MDXNET_Main.onnx");

// Ensure directories exist
[UPLOADS_DIR, OUTPUTS_DIR, MODEL_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// **1️⃣ Ensure Dependencies Are Installed**
function installDependencies() {
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

// **2️⃣ Automatically Download Model If Missing**
async function downloadModel() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(MODEL_PATH)) {
            console.log("✅ Model already exists.");
            return resolve();
        }

        console.log("🌍 Downloading ONNX Model...");
        const file = fs.createWriteStream(MODEL_PATH);
        https.get("https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_Main.onnx", (response) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log("✅ Model download complete.");
                resolve();
            });
        }).on("error", (error) => {
            console.error("❌ Error downloading model:", error);
            reject(error);
        });
    });
}

// **3️⃣ Configure Multer for File Uploads**
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// **4️⃣ Upload & Process Audio File**
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputFilePath = req.file.path;
    const outputPath = path.join(OUTPUTS_DIR, req.file.filename);

    console.log(`🎶 Processing file: ${inputFilePath}`);

    try {
        // Use Spleeter for separation (2-stem)
        execSync(`spleeter separate -o ${OUTPUTS_DIR} -p spleeter:2stems ${inputFilePath}`, { stdio: "inherit" });

        // Return the processed file URLs
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

// **5️⃣ Serve Processed Files**
app.get("/download/:file/:type", (req, res) => {
    const { file, type } = req.params;
    const filePath = path.join(OUTPUTS_DIR, file, `${type}.wav`);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// **6️⃣ Check Model Status**
app.get("/check-model", (req, res) => {
    if (fs.existsSync(MODEL_PATH)) {
        res.json({ status: "Model is available" });
    } else {
        res.status(404).json({ error: "Model not found. Please wait for it to download." });
    }
});

// **7️⃣ Start Server After Setup**
(async () => {
    installDependencies();
    await downloadModel();

    app.listen(PORT, () => {
        console.log(`🚀 Vocal Remover API running on port ${PORT}`);
    });
})();
