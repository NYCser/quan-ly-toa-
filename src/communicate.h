#ifndef COMMUNICATE_H
#define COMMUNICATE_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <coap-simple.h>
#include "home.h"

// server CoAP
#define COAP_SERVER_IP   "192.168.0.129"
#define COAP_SERVER_PORT 5683
#define COAP_STATUS_PATH "/status"

// CoAP client
extern Coap coap;

// init module
void Communicate_Init(SmartHome* home);

// gửi trạng thái SmartHome lên backend
void Communicate_SendStatus(SmartHome* home);

// xử lý JSON command từ backend
void Communicate_HandleCommand(const char* jsonStr, SmartHome* home);

// callback khi nhận CoAP message
void MyCoapCallback(CoapPacket &packet, IPAddress ip, int port);

#endif // COMMUNICATE_H