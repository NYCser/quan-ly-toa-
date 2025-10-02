#include "communicate.h"
#include <WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

// dùng con trỏ toàn cục để callback truy cập SmartHome
static SmartHome *g_home = NULL;

// UDP transport cho CoAP
WiFiUDP udp;

// CoAP client
Coap coap(udp); // gán UDP vào Coap

void Communicate_Init(SmartHome *home)
{
    g_home = home;
    coap.start();
    coap.response(MyCoapCallback);
    Serial.println("CoAP client started");
}

void Communicate_SendStatus(SmartHome *home)
{
    StaticJsonDocument<1024> doc;

    doc["voltage"] = home->ina219.getBusVoltage_V();
    doc["current"] = home->ina219.getCurrent_mA();
    doc["power"] = home->ina219.getPower_mW();

    

    JsonArray rooms = doc.createNestedArray("rooms");
    for (int i = 0; i < home->roomCount; i++)
    {
        Room *r = &home->rooms[i];
        JsonObject roomObj = rooms.createNestedObject();
        roomObj["name"] = r->name;
        roomObj["temp"] = r->temp;
        roomObj["humi"] = r->humi;
        roomObj["light"] = r->lightState ? "ON" : "OFF";
        roomObj["fan"] = r->fanState ? "ON" : "OFF";
    }

    char buffer[1024];
    size_t n = serializeJson(doc, buffer);

    IPAddress ip;
    ip.fromString(COAP_SERVER_IP);
    coap.put(ip, COAP_SERVER_PORT, COAP_STATUS_PATH, buffer, n);
}

void Communicate_HandleCommand(const char *jsonStr, SmartHome *home)
{
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, jsonStr);
    if (err)
        return;

    if (doc.containsKey("action"))
    {
        const char *action = doc["action"];
        if (strcmp(action, "add") == 0 && doc.containsKey("room"))
        {
            JsonObject r = doc["room"];
            SmartHome_AddRoom(home,
                              r["name"],
                              r["tempPin"] | -1,
                              r["lightPin"] | -1,
                              r["fanPin"] | -1);
        }
        else if (strcmp(action, "remove") == 0 && doc.containsKey("roomName"))
        {
            SmartHome_RemoveRoom(home, doc["roomName"]);
        }
        return; // xử lý action xong
    }

    // xử lý lệnh bật/tắt light/fan như trước
    for (int i = 0; i < home->roomCount; i++)
    {
        Room *r = &home->rooms[i];
        if (!doc.containsKey(r->name))
            continue;
        JsonObject roomCmd = doc[r->name];
        if (roomCmd.containsKey("light"))
            SmartHome_ControlDevice(r, "light", strcmp(roomCmd["light"], "ON") == 0);
        if (roomCmd.containsKey("fan"))
            SmartHome_ControlDevice(r, "fan", strcmp(roomCmd["fan"], "ON") == 0);
    }
}

// đổi tên callback để tránh conflict với typedef
void MyCoapCallback(CoapPacket &packet, IPAddress ip, int port)
{
    Serial.print("CoAP message from ");
    Serial.print(ip);
    Serial.print(":");
    Serial.println(port);

    char payload[packet.payloadlen + 1];
    memcpy(payload, packet.payload, packet.payloadlen);
    payload[packet.payloadlen] = '\0';

    Serial.print("Payload: ");
    Serial.println(payload);

    if (g_home != NULL)
    {
        Communicate_HandleCommand(payload, g_home);
    }
}
