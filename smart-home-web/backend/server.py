# server.py
import asyncio
import json
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from aiocoap import *
from aiocoap import resource
import threading
import uvicorn

app = FastAPI()
esp32_status = {}

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

# --------- Hàm gửi lệnh qua CoAP ----------
async def send_command_to_esp32(command: dict):
    protocol = await Context.create_client_context()
    payload = json.dumps(command).encode("utf-8")

    request = Message(
        code=POST,
        uri="coap://192.168.0.223:5683/esp32/control",
        payload=payload,
    )
    try:
        response = await protocol.request(request).response
        print("Response from ESP32:", response.code, response.payload.decode())
    except Exception as e:
        print("Failed to fetch resource:", e)

# --------- HTTP API cho frontend ----------
@app.get("/status")
def get_status():
    return JSONResponse(content=esp32_status)

@app.post("/control")
async def control(request: Request):
    command = await request.json()
    print("Send command to ESP32:", command)
    asyncio.create_task(send_command_to_esp32(command))
    return {"status": "sent"}

@app.post("/addRoom")
async def add_room(request: Request):
    room = await request.json()
    command = {"action": "add", "room": room}
    print("Add room command to ESP32:", command)
    asyncio.create_task(send_command_to_esp32(command))
    return {"status": "sent"}

@app.post("/removeRoom")
async def remove_room(request: Request):
    data = await request.json()
    command = {"action": "remove", "roomName": data["roomName"]}
    print("Remove room command to ESP32:", command)
    asyncio.create_task(send_command_to_esp32(command))
    return {"status": "sent"}

# --------- CoAP server nhận status ----------
class CoAPServer(resource.Resource):
    async def render_put(self, request):
        global esp32_status
        try:
            esp32_status = json.loads(request.payload.decode())
            print("Received status from ESP32 (CoAP):", esp32_status)
            return Message(code=CHANGED, payload=b"OK")
        except Exception as e:
            print("Invalid JSON from ESP32:", e)
            return Message(code=BAD_REQUEST, payload=b"Invalid JSON")

def start_coap_server():
    async def _run():
        root = resource.Site()
        root.add_resource(["esp32", "status"], CoAPServer())
        await Context.create_server_context(root, bind=("192.168.0.129", 5683))
        await asyncio.get_running_loop().create_future()  # giữ server chạy mãi

    asyncio.run(_run())


# --------- Main entry ---------
if __name__ == "__main__":
    # chạy CoAP server ở thread khác
    threading.Thread(target=start_coap_server, daemon=True).start()
    # chạy HTTP FastAPI
    uvicorn.run(app, host="0.0.0.0", port=3000)
