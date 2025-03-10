const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure output directories exist
const OUTPUTS_DIR = path.join(__dirname, "outputs");
if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
}

// **1️⃣ Ensure Python Environment**
function setupPythonEnv() {
    console.log("🔍 Checking Python virtual environment...");
    if (!fs.existsSync("venv")) {
        console.log("🚀 Creating Python virtual environment...");
        execSync("python3 -m venv venv");
    }

    console.log("⚡ Installing dependencies...");
    execSync("venv/bin/pip install --upgrade pip setuptools wheel", { stdio: "inherit" });

    if (!fs.existsSync("requirements.txt")) {
        console.log("⚠️ `requirements.txt` not found! Creating one...");
        fs.writeFileSync("requirements.txt", "torch\ntorchaudio\ndemucs\nnumpy\nffmpeg-python\n");
    }

    execSync("venv/bin/pip install -r requirements.txt", { stdio: "inherit" });
    console.log("✅ Python environment ready!");
}

// **2️⃣ Run Demucs for Vocal Separation**
app.get("/separate", async (req, res) => {
    console.log("🎵 Running Demucs...");
    try {
        execSync(`venv/bin/demucs --two-stems=vocals --no-cuda -o ${OUTPUTS_DIR} example.mp3`, { stdio: "inherit" });

        res.json({
            message: "✅ Separation complete!",
            vocals: `/outputs/vocals.wav`,
            instrumental: `/outputs/no_vocals.wav`,
        });
    } catch (error) {
        console.error("🚨 Error running Demucs:", error);
        res.status(500).json({ error: "Failed to process audio" });
    }
});

// **3️⃣ Serve Outputs & Start Server**
app.use("/outputs", express.static(OUTPUTS_DIR));

setupPythonEnv(); // Install dependencies
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
