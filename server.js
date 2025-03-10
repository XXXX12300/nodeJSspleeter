  const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ort = require("onnxruntime-node");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });
const MODEL_PATH = path.join(__dirname, "VocRem/UVR_MDXNET_Main.onnx");

// Ensure directories exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("output")) fs.mkdirSync("output");

// Load ONNX Model
let session;
(async () => {
  try {
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log("ONNX Model loaded!");
  } catch (error) {
    console.error("Failed to load model:", error);
  }
})();

// API Home Route
app.get("/", (req, res) => {
  res.send("🎶 Vocal Remover API is Running!");
});

// Upload & Process Audio
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputFilePath = req.file.path;
  const outputFilePath = `output/${req.file.filename}_processed.wav`;

  try {
    console.log("Processing file:", inputFilePath);

    // Convert input to WAV
    await new Promise((resolve, reject) => {
      ffmpeg(inputFilePath)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(outputFilePath);
    });

    // Read audio data
    const audioBuffer = fs.readFileSync(outputFilePath);
    const inputTensor = new ort.Tensor("float32", new Float32Array(audioBuffer), [1, 2, audioBuffer.length]);

    // Run ONNX Inference
    const results = await session.run({ "input": inputTensor });

    // Process outputs
    const vocalsOutput = results["vocals"].data;
    const instrumentalOutput = results["accompaniment"].data;

    // Save separated outputs
    fs.writeFileSync(`output/${req.file.filename}_vocals.wav`, Buffer.from(vocalsOutput));
    fs.writeFileSync(`output/${req.file.filename}_instrumental.wav`, Buffer.from(instrumentalOutput));

    res.json({
      message: "Processing complete!",
      vocals: `/download/${req.file.filename}_vocals.wav`,
      instrumental: `/download/${req.file.filename}_instrumental.wav`
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Failed to process audio." });
  }
});

// Download Processed Files
app.get("/download/:filename", (req, res) => {
  const file = path.join(__dirname, "output", req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "File not found" });
  res.download(file);
});

// Start Server
app.listen(PORT, () => {
  console.log(`🎶 Vocal Remover API running on port ${PORT}`);
});
