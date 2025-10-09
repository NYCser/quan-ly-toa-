#include "communicate.h"

// server CoAP
#define COAP_SERVER_IP   "192.168.1.30"
#define COAP_SERVER_PORT 5683

WiFiUDP udp;
Coap coap(udp);

static SmartHome *g_home = NULL;

void Communicate_Init(SmartHome *home)
{
    g_home = home;

    while (!coap.start()) {
        Serial.println("CoAP client start failed, retrying...");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
    coap.server(MyCoapCallback, COAP_CONTROL_PATH);
    coap.response(MyCoapCallback);
    Serial.printf("CoAP start on core %d\n", xPortGetCoreID());
    Serial.println("CoAP client started on port " +  String(COAP_SERVER_PORT));
}

void Communicate_Loop()
{
    coap.loop();
}

void Communicate_SendStatus(SmartHome *home)
{
    DynamicJsonDocument doc(128);

    doc["voltage"] = home->ina219.getBusVoltage_V();
    doc["current"] = home->ina219.getCurrent_mA();
    doc["power"]   = home->ina219.getPower_mW();
    JsonArray rooms = doc.createNestedArray("rooms");
    if (home->roomCount ==  0) {
        Serial.println("No room configured, not sending status");
        goto send;
    }
    for (int i = 0; i < home->roomCount; i++) {
        JsonObject roomObj = rooms.createNestedObject();
        roomObj["name"]  = home->rooms[i].name;
        roomObj["temp"]  = home->rooms[i].temp;
        roomObj["humi"]  = home->rooms[i].humi;
        roomObj["light"] = home->rooms[i].lightState ? "ON" : "OFF";
        roomObj["fan"]   = home->rooms[i].fanState   ? "ON" : "OFF";
    }
send:
    char buffer[256];
    size_t n = serializeJson(doc, buffer, sizeof(buffer));

    String msg = String(buffer);
    
    IPAddress ip;
    if (!ip.fromString(COAP_SERVER_IP)) {
        Serial.println("Invalid COAP_SERVER_IP");
        return;
    }
    int ret = coap.put(ip, COAP_SERVER_PORT, COAP_STATUS_PATH, msg.c_str());
    Serial.println("Sending to " COAP_SERVER_IP ":" + String(COAP_SERVER_PORT) + " : " + msg + "(" + String(msg.length()) + " bytes)");
}


void Communicate_HandleCommand(const char *jsonStr, SmartHome *home)
{
    DynamicJsonDocument doc(128);
    DeserializationError err = deserializeJson(doc, jsonStr);
    if (err) {
        Serial.print("JSON parse error: ");
        Serial.println(err.c_str());
        return;
    }
    Serial.println("Received command:");
    serializeJsonPretty(doc, Serial);
    Serial.println();

    // Xử lý action add/remove room
    if (doc.containsKey("action"))
    {
        const char *action = doc["action"];
        if (strcmp(action, "add") == 0 && doc.containsKey("room"))
        {
            JsonObject r = doc["room"];
            Serial.print("Add room: ");
            Serial.println((const char*)r["name"]);
            SmartHome_AddRoom(home,
                              r["name"] | "Unnamed",
                              r["tempPin"] | -1,
                              r["lightPin"] | -1,
                              r["fanPin"] | -1);
        }
        else if (strcmp(action, "remove") == 0 && doc.containsKey("roomName"))
        {
            const char* rmName = doc["roomName"];
            Serial.print("Remove room: ");
            Serial.println(rmName);
            SmartHome_RemoveRoom(home, rmName);
        }
        return; // đã xử lý action
    }

    // Nếu không có action thì coi như lệnh điều khiển device
    for (int i = 0; i < home->roomCount; i++)
    {
        Room *r = &home->rooms[i];
        if (!doc.containsKey(r->name))
            continue;

        JsonObject roomCmd = doc[r->name];
        if (roomCmd.containsKey("light"))
        {
            const char* state = roomCmd["light"];
            Serial.printf("Control %s light: %s\n", r->name, state);
            SmartHome_ControlDevice(r, "light", strcasecmp(state, "ON") == 0);
        }
        if (roomCmd.containsKey("fan"))
        {
            const char* state = roomCmd["fan"];
            Serial.printf("Control %s fan: %s\n", r->name, state);
            SmartHome_ControlDevice(r, "fan", strcasecmp(state, "ON") == 0);
        }
    }
}

// đổi tên callback để tránh conflict với typedef
void MyCoapCallback(CoapPacket &packet, IPAddress ip, int port)
{
    // Serial.print("CoAP message from ");
    // Serial.print(ip);
    // Serial.print(":");
    // Serial.println(port);

    // copy payload sang buffer an toàn
    char payload[packet.payloadlen + 1];
    memcpy(payload, packet.payload, packet.payloadlen);
    payload[packet.payloadlen] = '\0';

    Serial.print("Payload: ");
    Serial.println(payload);

    // Kiểm tra loại gói tin
    if (packet.code == COAP_POST) {
        // Đây là lệnh từ backend gửi tới ESP32 (/esp32/control)
        if (g_home != NULL) {
            Communicate_HandleCommand(payload, g_home);
        }

        // Trả lời OK về cho backend
        coap.sendResponse(ip, port, packet.messageid,
                          "OK", 2,
                          COAP_CONTENT, COAP_TEXT_PLAIN,
                          packet.token, packet.tokenlen);
    }
    else {
        // Serial.println("Not a POST command, ignoring...");
    }
}
