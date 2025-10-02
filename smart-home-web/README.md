# Smart Home Web (CoAP + ESP32)

This project is a **web-based control panel** for a smart home system using **ESP32** and the **CoAP protocol**.  
It provides a simple web interface (HTML + JS) to monitor and control devices such as **fan** and **light**.  
Communication between the web and ESP32 goes through a **Node.js backend** (Express + CoAP).

---

## 📌 Features
- Control **fan** and **light** from the web UI
- Send commands in JSON format over CoAP
- Forwarding via Node.js backend
- Display sensor data (temperature, humidity, power) on LCD 16x2 and web (from ESP32 side)
- Built with **PlatformIO (ESP32 + Arduino framework)** and **Node.js (Express + CoAP)**

---

## 🛠️ Requirements

- **Node.js**: v18.x or newer (tested on Node.js v22.20.0)  
- **npm**: v9.x or newer  
- **ESP32 firmware** (developed in PlatformIO, using `coap-simple` and `LiquidCrystal_I2C` libraries)

---

## 📂 Project Structure

```
smart-home-web/
├── backend/
│ └── server.js # Node.js backend (Express + CoAP)
├── frontend/
│ └── index.html # Simple HTML + JS web interface
├── package.json # Node.js dependencies and scripts
└── README.md # Project documentation
```
---
## 📡 Data Frame

### Command (Web → ESP32 via CoAP)
JSON payload sent to ESP32:
```json
{
  "fan": "on",
  "light": "off"
}
{
  "temperature": 28,
  "humidity": 65,
  "power": 12.5,
  "fan": "on",
  "light": "off"
}
```
---
## 🚀 Installation & Run
1. Clone repository:
```bash
git clone https://github.com/NYCser/smart-home-web.git
cd smart-home-web
```
2. Install dependencies:
```bash
npm install
```
3. Start backend server:
```bash
npm start
```
4. Open browser:
```
http://localhost:3000
```
---