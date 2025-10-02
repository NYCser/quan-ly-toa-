import coap from "coap";

// IP và port ESP32
const ESP32_IP = "192.168.1.50";
const ESP32_PORT = 5683;

export function sendCommandToESP32(commandJson) {
	console.log("Sending command to ESP32 via CoAP:", commandJson);
	const req = coap.request({
		hostname: ESP32_IP,
		port: ESP32_PORT,
		method: "PUT",
		pathname: "/smart-home/command",
		confirmable: true,
	});

	req.write(JSON.stringify(commandJson));

	req.on("response", (res) => {
		console.log("Response from ESP32:", res.payload.toString());
	});

	req.on("error", (err) => {
		console.error("CoAP request error:", err);
	});

	req.end();
}
