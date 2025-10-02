import coap from "coap";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { sendCommandToESP32 } from "./coap_client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

let esp32Status = {};

// HTTP server (frontend + API)
app.get("/status", (req, res) => {
  res.json(esp32Status);
});

app.post("/control", (req, res) => {
  const command = req.body;
  console.log("Send command to ESP32:", command);
  sendCommandToESP32(command);
  res.status(200).json({ status: "sent" });
});

app.post("/addRoom", (req, res) => {
  const room = req.body;
  const command = { action: "add", room };
  console.log("Add room command to ESP32:", command);
  sendCommandToESP32(command);
  res.status(200).json({ status: "sent" });
});

app.post("/removeRoom", (req, res) => {
  const roomName = req.body.roomName;
  const command = { action: "remove", roomName };
  console.log("Remove room command to ESP32:", command);
  sendCommandToESP32(command);
  res.status(200).json({ status: "sent" });
});

app.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
});

// CoAP server để nhận trạng thái từ ESP32
const coapServer = coap.createServer();

coapServer.on("request", (req, res) => {
  if (req.method === "PUT" && req.url === "/esp32/status") {
    let payload = "";

    req.on("data", (chunk) => {
      payload += chunk;
    });

    req.on("end", () => {
      try {
        esp32Status = JSON.parse(payload);
        console.log("Received status from ESP32 (CoAP):", esp32Status);
        res.code = "2.04"; // Changed
        res.end("OK");
      } catch (e) {
        console.error("Invalid JSON from ESP32:", e);
        res.code = "4.00"; // Bad Request
        res.end("Invalid JSON");
      }
    });
  } else {
    res.code = "4.04"; // Not Found
    res.end("Not Found");
  }
});

coapServer.listen(() => {
  console.log("CoAP Server listening on port 5683");
});
