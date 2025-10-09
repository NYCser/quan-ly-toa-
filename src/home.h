#ifndef SMART_HOME_H
#define SMART_HOME_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include "FileSystem.h"

#define MAX_ROOMS       5
#define MAX_NAME_LEN    16
#define DHTTYPE         DHT11

#define FILE_CONFIG     "/config.json"

#pragma pack(push, 1)
typedef struct {
    char name[MAX_NAME_LEN];
    DHT* dht;
    int dhtPin;        // DHT11
    int lightPin;      // actuator
    int fanPin;        // actuator
    float temp;
    float humi;
    bool lightState;
    bool fanState;
} Room;
#pragma pack(pop)

typedef struct {
    Room rooms[MAX_ROOMS];
    int roomCount;
    int currentRoom;       // index room đang hiển thị trên LCD
    LiquidCrystal_I2C* lcd;
    Adafruit_INA219 ina219;
    int buttonPin;         // nút chuyển phòng
} SmartHome;

void SmartHome_Init(SmartHome* home, int buttonPin);

bool SmartHome_LoadConfig(SmartHome *home, const char *filename);
bool SmartHome_SaveConfig(SmartHome *home, const char *filename);
void SmartHome_ResetConfig(SmartHome *home);

bool SmartHome_AddRoom(SmartHome* home, const char* name,
                       int dhtPin, int lightPin, int fanPin);
void SmartHome_RemoveRoom(SmartHome* home, const char* name);

void SmartHome_Update(SmartHome* home);      // đọc dữ liệu cảm biến + công tắc
void SmartHome_Display(SmartHome* home);     // hiển thị LCD
void SmartHome_NextRoom(SmartHome* home);    // đổi phòng khi nhấn nút
void SmartHome_ControlDevice(Room* room, const char* device, bool state);

#endif
