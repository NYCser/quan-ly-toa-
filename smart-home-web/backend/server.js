// server.js
import coap from "coap";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Chỉ định static folder
const staticPath = path.join(__dirname, "../frontend");
console.log("Serving static files from:", staticPath);
app.use(express.static(staticPath));
app.use(bodyParser.json());

let esp32Status = {};

// mở database
const dbPromise = open({
	filename: "data/sensors.db",
	driver: sqlite3.Database,
});

// khởi tạo table nếu chưa có
(async () => {
	const db = await dbPromise;
	await db.exec(`
CREATE TABLE IF NOT EXISTS sensor_data (
id INTEGER PRIMARY KEY AUTOINCREMENT,
room TEXT,
temp REAL,
humi REAL,
voltage REAL,
current REAL,
power REAL,
timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
})();

process.on("uncaughtException", (err) => {
	console.error("UNCAUGHT EXCEPTION (will keep running):", err && err.stack ? err.stack : err);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("UNHANDLED REJECTION (promise):", promise, "reason:", reason);
});

// Hàm gửi lệnh qua CoAP
function sendCommandToESP32(command) {
	const req = coap.request({
		hostname: "192.168.1.5", // IP ESP32 của bạn
		port: 5683,
		method: "POST",
		pathname: "/esp32/control",
	});

	console.log("Sending command to ESP32:", command);
	const json = JSON.stringify(command);
	if (json.length > 512) {
		console.warn("Payload too large, skipping CoAP send");
		return;
	}
	req.write(json);
	req.end();

	req.on("response", (res) => {
		console.log("Response from ESP32:", res.code, res.payload?.toString());
	});

	req.on("error", (err) => {
		console.error("CoAP request error:", err);
	});
}

// HTTP API cho frontend
app.get("/status", (req, res) => {
	res.json(esp32Status);
});

// API trả về dữ liệu lịch sử
app.get("/history", async (req, res) => {
	try {
		const db = await dbPromise;
		// Lấy 50 bản ghi mới nhất, sắp xếp theo thời gian
		const rows = await db.all(
			"SELECT room, temp, humi, voltage, current, power, timestamp FROM sensor_data ORDER BY timestamp DESC LIMIT 50",
		);
		res.json(rows);
	} catch (err) {
		console.error("Error fetching history:", err);
		res.status(500).json({ error: "Database error" });
	}
});

app.post("/control", (req, res) => {
	sendCommandToESP32(req.body);
	res.status(200).json({ status: "sent" });
});

app.post("/addRoom", (req, res) => {
	sendCommandToESP32(req.body); // không bọc thêm action/room
	res.status(200).json({ status: "sent" });
});

app.post("/removeRoom", (req, res) => {
	sendCommandToESP32({ action: "remove", roomName: req.body.roomName });
	res.status(200).json({ status: "sent" });
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`HTTP Server running on http://0.0.0.0:${PORT}`);
});

// CoAP server nhận trạng thái từ ESP32
const coapServer = coap.createServer();

coapServer.on("request", (req, res) => {
	if (req.method === "PUT" && req.url === "/esp32/status") {
		let payload = "";

		req.on("data", (chunk) => {
			payload += chunk;
		});

		req.on("error", (err) => {
			console.error("CoAP request stream error:", err);
		});

		req.on("end", async () => {
			try {
				// 1. Phân tích cú pháp payload
				const newStatus = JSON.parse(payload);
				esp32Status = newStatus; // Cập nhật trạng thái
				console.log("Received status from ESP32 (CoAP):", esp32Status);

				// 2. Lưu vào SQLite
				const db = await dbPromise;

				if (esp32Status.rooms && Array.isArray(esp32Status.rooms)) {
					// Dùng transaction để tăng tốc độ ghi DB (tùy chọn)
					// await db.run('BEGIN TRANSACTION');

					const stmt = await db.prepare(`
INSERT INTO sensor_data (room, temp, humi, voltage, current, power) 
VALUES (?, ?, ?, ?, ?, ?)
`);

					for (const r of esp32Status.rooms) {
						// Thêm dữ liệu cảm biến của từng phòng
						await stmt.run(
							r.name,
							r.temp ?? null,
							r.humi ?? null,
							// Dữ liệu chung
							esp32Status.voltage ?? null,
							esp32Status.current ?? null,
							esp32Status.power ?? null,
						);
					}

					// Chỉ finalize (đóng statement) MỘT LẦN sau khi vòng lặp kết thúc
					await stmt.finalize();

					// await db.run('COMMIT');
				}

				res.code = "2.04"; // Changed
				res.end("OK");
			} catch (e) {
				// await db.run('ROLLBACK'); // Nếu dùng transaction
				console.error("Error processing CoAP payload or inserting to DB:", e);
				res.code = "4.04";
				res.end("Not Found");
			}
		});
	} else {
		res.code = "5.00";
		res.end("Server Error");
	}
});

coapServer.listen(5683, "0.0.0.0", () => {
	console.log("CoAP Server listening on 0.0.0.0:5683");
});

coapServer.on("error", (err) => {
	console.error("❌ CoAP server error:", err);
});
