{
  "name": "vocal-remover-api",
  "version": "1.0.0",
  "description": "A simple API to remove vocals from songs using ONNX or Demucs.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5",
    "onnxruntime-node": "^1.15.0",
    "wav": "^1.0.2",
    "@ffmpeg/ffmpeg": "^0.11.6",
    "@ffmpeg/core": "^0.11.6",
    "fluent-ffmpeg": "^2.1.2"
  }
}
