let currentRoom = "";
let data = null;
let role = "guest";

// Dummy account list
const accounts = {
	admin: { username: "admin", password: "admin" },
	user: { username: "user", password: "abcd" },
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

// Mở giao diện phòng (sửa: dùng data.rooms)
function openRoom(roomName) {
	currentRoom = roomName;
	document.getElementById("homeScreen").classList.add("hidden");
	document.getElementById("roomScreen").classList.remove("hidden");
	document.getElementById("roomTitle").innerText = roomName;
	const room = data.rooms.find((r) => r.name === roomName);
	if (room) {
		document.getElementById("roomDetail").innerHTML = `
      <p>Nhiệt độ: ${room.temp?.toFixed(1) ?? "-"}°C</p>
      <p>Độ ẩm: ${room.humi?.toFixed(1) ?? "-"}%</p>
    `;
		const btnLight = document.getElementById("btn-light");
		btnLight.textContent = room.light?.toUpperCase() || "OFF";
		btnLight.style.backgroundColor = room.light === "on" ? "green" : "red";
		btnLight.style.color = "white";
		const btnFan = document.getElementById("btn-fan");
		btnFan.textContent = room.fan?.toUpperCase() || "OFF";
		btnFan.style.backgroundColor = room.fan === "on" ? "green" : "red";
		btnFan.style.color = "white";
	}
}

// Quay về home
function openHome() {
	document.getElementById("roomScreen").classList.add("hidden");
	document.getElementById("homeScreen").classList.remove("hidden");
}

// Toggle thiết bị (demo: toggle state local, không backend)
async function toggleDevice(device) {
	if (!currentRoom) {
		alert("Chưa chọn phòng!");
		return;
	}
	const room = data.rooms.find((r) => r.name === currentRoom);
	if (!room) return;
	// Toggle trạng thái thiết bị
	const currentState = room[device]?.toLowerCase() || "off";
	const newState = currentState === "on" ? "OFF" : "ON";
	room[device] = newState.toLowerCase();
	// Tạo payload theo định dạng backend yêu cầu
	const payload = {};
	payload[currentRoom] = {
		fan: room.fan?.toUpperCase() || "OFF",
		light: room.light?.toUpperCase() || "OFF",
	};
	try {
		const res = await fetch("/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (res.ok) {
			openRoom(currentRoom);
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

function updateUI(data) {
	if (!data) return;
	document.getElementById("voltage").textContent = data.voltage || "220V";
	document.getElementById("current").textContent = data.current || "5A";
	document.getElementById("energy").textContent = data.energy || "1.2 kWh";
	renderRooms();
	// Nếu đang mở phòng, cập nhật lại UI phòng
	if (currentRoom) {
		openRoom(currentRoom);
	}
}
// Tự động refresh trạng thái mỗi 2 giây
setInterval(fetchStatus, 2000);
fetchStatus();
