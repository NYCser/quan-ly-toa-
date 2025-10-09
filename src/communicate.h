#ifndef COMMUNICATE_H
#define COMMUNICATE_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>

#define COAP_BUF_MAX_SIZE 512

#include <coap-simple.h>
#include "home.h"


// CoAP path
#define COAP_STATUS_PATH  "esp32/status"
#define COAP_CONTROL_PATH "esp32/control"

// init module
void Communicate_Init(SmartHome* home);

// vòng lặp xử lý CoAP
void Communicate_Loop();

// gửi trạng thái SmartHome lên backend
void Communicate_SendStatus(SmartHome* home);

// xử lý JSON command từ backend
void Communicate_HandleCommand(const char* jsonStr, SmartHome* home);

// callback khi nhận CoAP message
void MyCoapCallback(CoapPacket &packet, IPAddress ip, int port);

#endif // COMMUNICATE_H