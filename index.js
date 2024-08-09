const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ytdlp = require("yt-dlp-exec");
const axios = require("axios");
const cors = require("cors");
const dotEnv = require("dotenv");
dotEnv.config();
const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

const dir = "public";
const subDir = "public/uploads";
const mp3Dir = "public/mp3s";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
  fs.mkdirSync(subDir);
}

if (!fs.existsSync(mp3Dir)) {
  fs.mkdirSync(mp3Dir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, subDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/convert", upload.single("file"), async (req, res) => {
  try {
    if (req.file) {
      const outputFileName = `${Date.now()}-convertedAudio.mp3`;
      const output = path.join(mp3Dir, outputFileName);

      ffmpeg(req.file.path)
        .toFormat("mp3")
        .on("end", async () => {
          console.log("File is converted");
          const fileUrl = `${req.protocol}://${req.get(
            "host"
          )}/mp3s/${outputFileName}`;

          const testAudioUrl =
            "https://github.com/AssemblyAI-Community/audio-examples/raw/main/20230607_me_canadian_wildfires.mp3";
          const transcript = await transcribeAudio(testAudioUrl);

          res.json({
            success: true,
            data: {
              downloadLink: fileUrl,
            },
            error: null,
          });
        })
        .saveToFile(output);
    } else if (req.body.videoURL) {
      const outputFileName = `${Date.now()}-convertedAudio.mp3`;
      const output = path.join(mp3Dir, outputFileName);

      ytdlp(req.body.videoURL, {
        extractAudio: true,
        audioFormat: "mp3",
        output: output,
      })
        .then(async () => {
          console.log("Video is converted");
          const fileUrl = `${req.protocol}://${req.get(
            "host"
          )}/mp3s/${outputFileName}`;

          const testAudioUrl =
            "https://github.com/AssemblyAI-Community/audio-examples/raw/main/20230607_me_canadian_wildfires.mp3";
          const transcript = await transcribeAudio(testAudioUrl);

          res.json({
            success: true,
            data: {
              url: fileUrl,
              transcript: transcript,
            },
            error: null,
          });
        })
        .catch((error) => {
          console.log(`Convert Error: ${error}`);
          res.json({
            success: false,
            data: null,
            error: `Error converting video: ${error.message}`,
          });
        });
    } else {
      res.json({
        success: false,
        data: null,
        error: "No file or videoURL provided",
      });
    }
  } catch (error) {
    console.error(`Server Error: ${error}`);
    res.json({
      success: false,
      data: null,
      error: `Server error: ${error.message}`,
    });
  }
});

async function transcribeAudio(url) {
  const apiUrl = `https://transcribe-worker.web-performance-tools.workers.dev/?audioUrl=${url}`;

  try {
    const response = await axios.get(apiUrl);
    const transcriptData = response.data;
    console.log(transcriptData);

    if (
      transcriptData.speakerData &&
      Array.isArray(transcriptData.speakerData)
    ) {
      return transcriptData.speakerData.join("\n\n");
    }
    return "Transcript not available";
  } catch (error) {
    console.error(`Transcription Error: ${error}`);
    return "Error transcribing audio";
  }
}

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});
