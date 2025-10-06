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

// Hàm gửi lệnh qua CoAP
function sendCommandToESP32(command) {
	const req = coap.request({
		hostname: "192.168.1.50", // IP ESP32 của bạn
		port: 5683,
		method: "POST",
		pathname: "/esp32/control",
	});

	req.write(JSON.stringify(command));
	req.end();

	req.on("response", (res) => {
		console.log("Response from ESP32:", res.code, res.payload.toString());
	});
}

// HTTP API cho frontend
app.get("/status", (req, res) => {
	// res.json(esp32Status);
	res.json({
		voltage: 28.0,
		current: 65.0,
		power: 12.5,
		rooms: [
			{ name: "Bed Room Floor 1", temp: 25, humi: 50, fan: "ON", light: "OFF" },
			{
				name: "Bed Room Floor 2",
				temp: 27,
				humi: 45,
				fan: "OFF",
				light: "OFF",
			},
			{ name: "Living Room", temp: 30, humi: 30, fan: "OFF", light: "ON" },
		],
	});
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
				res.end(); // Không cần 'OK' trong response code 2.04
			} catch (e) {
				// await db.run('ROLLBACK'); // Nếu dùng transaction
				console.error("Error processing CoAP payload or inserting to DB:", e);
				res.code = "4.00"; // Bad Request
				res.end("Invalid JSON or DB error");
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
