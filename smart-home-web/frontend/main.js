let currentRoom = "";
let data = null;
let role = "guest";

let mainPowerChart = null;
let roomTempHumiChart = null;
let historyDataCache = [];
const HISTORY_REFRESH_INTERVAL = 30000;
const UI_REFRESH_INTERVAL = 1000;

// Dummy account list
const accounts = {
	admin: { username: "admin", password: "1" },
	user: { username: "user", password: "1" },
};

function login() {
	const u = document.getElementById("username").value.trim();
	const p = document.getElementById("password").value.trim();
	const errorEl = document.getElementById("loginError");
	errorEl.style.display = "none";
	if (u === accounts.admin.username && p === accounts.admin.password) {
		role = "admin";
	} else if (u === accounts.user.username && p === accounts.user.password) {
		role = "user";
	} else {
		errorEl.innerText = "Sai username hoặc password!";
		errorEl.style.display = "block";
		return;
	}
	document.getElementById("roleDisplay").innerText =
		"ROLE: " + role.toUpperCase();
	document.getElementById("loginScreen").classList.add("hidden");
	document.getElementById("homeScreen").classList.remove("hidden");
	if (role === "admin") {
		document.getElementById("adminControls").classList.remove("hidden");
	} else {
		document.getElementById("adminControls").classList.add("hidden");
	}
	fetchStatus();
}

// Đăng xuất
function logout() {
	role = "guest";
	currentRoom = "";
	document.getElementById("roleDisplay").innerText = "ROLE: -";
	document.getElementById("homeScreen").classList.add("hidden");
	document.getElementById("roomScreen").classList.add("hidden");
	document.getElementById("loginScreen").classList.remove("hidden");
	document.getElementById("username").value = "";
	document.getElementById("password").value = "";
}

// Render danh sách phòng ra UI
function renderRooms() {
	const grid = document.getElementById("roomsGrid");
	if (!data || !data.rooms) return;
	grid.innerHTML = "";
	data.rooms.forEach((room) => {
		const div = document.createElement("div");
		div.className = "room-card";
		div.innerText = room.name;
		div.onclick = () => openRoom(room.name);
		grid.appendChild(div);
	});
}

// Hàm vẽ đồ thị chi tiết phòng (Nhiệt độ, Độ ẩm)
function drawRoomTempHumiChart(roomName, history) {
	// Lọc dữ liệu chỉ cho phòng đang xem
	const roomHistory = history.filter((item) => item.room === roomName);
	const reversedHistory = [...roomHistory].reverse();

	const labels = reversedHistory.map((item) => {
		const date = new Date(item.timestamp);
		return date.toLocaleTimeString("vi-VN", {
			hour: "2-digit",
			minute: "2-digit",
		});
	});

	const tempData = reversedHistory.map((item) => item.temp);
	const humiData = reversedHistory.map((item) => item.humi);

	const ctx = document.getElementById("roomTempHumiChart").getContext("2d");

	// Hủy đồ thị cũ nếu có
	if (roomTempHumiChart) {
		roomTempHumiChart.destroy();
	}

	roomTempHumiChart = new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Nhiệt độ (°C)",
					data: tempData,
					borderColor: "rgb(255, 99, 132)", // Đỏ
					tension: 0.1,
					yAxisID: "Temp",
				},
				{
					label: "Độ ẩm (%)",
					data: humiData,
					borderColor: "rgb(54, 162, 235)", // Xanh dương
					tension: 0.1,
					yAxisID: "Humi",
				},
			],
		},
		options: {
			responsive: true,
			scales: {
				Temp: {
					type: "linear",
					position: "left",
					title: { display: true, text: "Nhiệt độ (°C)" },
				},
				Humi: {
					type: "linear",
					position: "right",
					title: { display: true, text: "Độ ẩm (%)" },
					grid: { drawOnChartArea: false },
				},
			},
		},
	});
}

async function openRoom(roomName) {
	currentRoom = roomName;
	document.getElementById("homeScreen").classList.add("hidden");
	document.getElementById("roomScreen").classList.remove("hidden");
	document.getElementById("roomTitle").innerText = roomName;

	const room = data.rooms.find((r) => r.name === roomName);
	if (room) {
		// Hiển thị thông số (Cập nhật lại theo cấu trúc HTML mới)
		document.querySelector(
			"#roomScreen .bg-red-50 span:nth-child(2)",
		).textContent = `${room.temp?.toFixed(1) ?? "-"}°C`;
		document.querySelector(
			"#roomScreen .bg-blue-50 span:nth-child(2)",
		).textContent = `${room.humi?.toFixed(1) ?? "-"}%`;

		// Light
		const btnLight = document.getElementById("btn-light");
		const lightState = (room.light || "OFF").toUpperCase();
		btnLight.textContent = lightState.toUpperCase();
		btnLight.style.backgroundColor = lightState === "ON" ? "green" : "red";
		btnLight.style.color = "white";

		// Fan
		const btnFan = document.getElementById("btn-fan");
		const fanState = (room.fan || "OFF").toUpperCase();
		btnFan.textContent = fanState.toUpperCase();
		btnFan.style.backgroundColor = fanState === "ON" ? "green" : "red";
		btnFan.style.color = "white";

		drawRoomTempHumiChart(roomName, historyDataCache);
	}
}

// Quay về home
function openHome() {
	document.getElementById("roomScreen").classList.add("hidden");
	document.getElementById("homeScreen").classList.remove("hidden");
	currentRoom = null;

	if (roomTempHumiChart) {
		roomTempHumiChart.destroy();
		roomTempHumiChart = null;
	}

	drawMainPowerChart(historyDataCache);
}

function drawMainPowerChart(history) {
	// Đảo ngược dữ liệu để đồ thị hiển thị thời gian tăng dần
	const reversedHistory = [...history].reverse();

	const labels = reversedHistory.map((item) => {
		// Định dạng thời gian cho dễ đọc
		const date = new Date(item.timestamp);
		return date.toLocaleTimeString("vi-VN", {
			hour: "2-digit",
			minute: "2-digit",
		});
	});

	const voltageData = reversedHistory.map((item) => item.voltage);
	const currentData = reversedHistory.map((item) => item.current);
	const powerData = reversedHistory.map((item) => item.power);

	const ctx = document.getElementById("mainPowerChart").getContext("2d");

	// Hủy đồ thị cũ nếu có
	if (mainPowerChart) {
		mainPowerChart.destroy();
	}

	mainPowerChart = new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Điện áp (V)",
					data: voltageData,
					borderColor: "rgb(54, 162, 235)", // Xanh dương
					tension: 0.1,
					yAxisID: "V",
				},
				{
					label: "Dòng điện (A)",
					data: currentData,
					borderColor: "rgb(255, 99, 132)", // Đỏ
					tension: 0.1,
					yAxisID: "A",
				},
				{
					label: "Công suất (W)",
					data: powerData,
					borderColor: "rgb(75, 192, 192)", // Xanh lá
					tension: 0.1,
					yAxisID: "W",
				},
			],
		},
		options: {
			responsive: true,
			scales: {
				V: {
					type: "linear",
					position: "left",
					title: { display: true, text: "Điện áp (V)" },
					grid: { drawOnChartArea: false },
				},
				A: {
					type: "linear",
					position: "right",
					title: { display: true, text: "Dòng điện (A)" },
					grid: { drawOnChartArea: false },
				},
				W: {
					type: "linear",
					position: "right",
					title: { display: true, text: "Công suất (W)" },
					grid: { drawOnChartArea: false },
				},
			},
		},
	});
}
// Toggle thiết bị
async function toggleDevice(device) {
	if (!currentRoom) {
		alert("Chưa chọn phòng!");
		return;
	}
	const room = data.rooms.find((r) => r.name === currentRoom);
	if (!room) return;

	// Toggle trạng thái thiết bị (luôn dùng lowercase)
	const currentState = (room[device] || "OFF").toUpperCase();
	const newState = currentState === "ON" ? "OFF" : "ON";
	room[device] = newState;

	// Payload gửi về backend (luôn lowercase)
	const payload = {};
	payload[currentRoom] = {
		fan: room.fan || "OFF",
		light: room.light || "OFF",
	};

	try {
		const res = await fetch("/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (res.ok) {
			openRoom(currentRoom); // cập nhật lại UI
		} else {
			alert("Lỗi khi gửi lệnh điều khiển");
		}
	} catch (err) {
		alert("Lỗi mạng khi gửi lệnh điều khiển");
		console.error(err);
	}
}

// Thêm phòng (demo: thêm vào data local)
async function addRoom() {
	if (role !== "admin") {
		alert("Chỉ admin mới được thêm phòng!");
		return;
	}
	const room = {
		name: document.getElementById("new-room-name").value.trim(),
		tempPin: parseInt(document.getElementById("temp-pin").value) || -1,
		lightPin: parseInt(document.getElementById("light-pin").value) || -1,
		fanPin: parseInt(document.getElementById("fan-pin").value) || -1,
	};
	if (!room.name) {
		alert("Vui lòng nhập tên phòng");
		return;
	}
	const payload = {
		action: "add",
		room: {
			name: room.name,
			tempPin: room.tempPin,
			lightPin: room.lightPin,
			fanPin: room.fanPin,
		},
	};
	try {
		const res = await fetch("/addRoom", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (res.ok) {
			alert("Đã gửi lệnh thêm phòng");
			fetchStatus();
			// Xóa input sau khi thêm
			document.getElementById("new-room-name").value = "";
			document.getElementById("temp-pin").value = "";
			document.getElementById("light-pin").value = "";
			document.getElementById("fan-pin").value = "";
		} else {
			alert("Lỗi khi gửi lệnh thêm phòng");
		}
	} catch (err) {
		alert("Lỗi mạng khi gửi lệnh thêm phòng");
		console.error(err);
	}
}

// Xóa phòng (demo: xóa từ data local)
async function removeRoom() {
	if (role !== "admin") {
		alert("Chỉ admin mới được xóa phòng!");
		return;
	}
	const roomName = document.getElementById("new-room-name").value.trim();
	if (!roomName) {
		alert("Vui lòng nhập tên phòng cần xóa");
		return;
	}
	const payload = {
		action: "remove",
		roomName: roomName,
	};
	try {
		const res = await fetch("/removeRoom", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (res.ok) {
			alert("Đã gửi lệnh xóa phòng");
			fetchStatus();
			document.getElementById("new-room-name").value = "";
		} else {
			alert("Lỗi khi gửi lệnh xóa phòng");
		}
	} catch (err) {
		alert("Lỗi mạng khi gửi lệnh xóa phòng");
		console.error(err);
	}
}

async function fetchHistory() {
	try {
		const res = await fetch("/history");
		if (res.ok) {
			const historyData = await res.json();
			return historyData;
		} else {
			console.error("Lỗi khi lấy dữ liệu lịch sử:", res.status);
			return [];
		}
	} catch (err) {
		console.error("Lỗi fetchHistory:", err);
		return [];
	}
}

async function loadAndDrawHistory() {
	console.log("Loading history data...");
	historyDataCache = await fetchHistory();
	// Chỉ vẽ đồ thị nếu đang ở Home Screen
	if (
		!currentRoom &&
		document.getElementById("homeScreen").classList.contains("hidden") === false
	) {
		drawMainPowerChart(historyDataCache);
	}
	// Nếu đang ở Room Screen, gọi lại openRoom để vẽ chart phòng
	if (currentRoom) {
		openRoom(currentRoom);
	}
}

// Giả lập fetchStatus (demo, không cần backend)
async function fetchStatus() {
	try {
		const res = await fetch("/status");
		if (res.ok) {
			data = await res.json();
			updateUI(data);
		} else {
			console.error("Lỗi khi lấy trạng thái:", res.status);
		}
	} catch (err) {
		console.error("Lỗi fetchStatus:", err);
	}
}

async function updateUI(data) {
	// Thêm async
	if (!data) return;
	document.getElementById("voltage").textContent =
		`${data.voltage?.toFixed(1) ?? "-"} V`;
	document.getElementById("current").textContent =
		`${data.current?.toFixed(1) ?? "-"} A`;
	document.getElementById("energy").textContent =
		`${data.power?.toFixed(1) ?? "-"} W`; // Thay kWh bằng W (Công suất tức thời)

	renderRooms();

	// Nếu đang mở phòng, cập nhật lại UI phòng
	if (currentRoom) {
		openRoom(currentRoom);
	}
}

setInterval(fetchStatus, UI_REFRESH_INTERVAL);
fetchStatus();
setInterval(loadAndDrawHistory, HISTORY_REFRESH_INTERVAL);
loadAndDrawHistory();
