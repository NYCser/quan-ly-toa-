#include <Arduino.h>
#include <WiFi.h>

#include "FileSystem.h"
#include "home.h"
#include "communicate.h"

// Thay bằng WiFi của bạn
const char *ssid = "RoboViet_2.4G";
const char *password = "roboviet";

// SmartHome struct
SmartHome home;
FFS filesystem;

bool IsSend = false;

// Task Home: sensor, LCD, công tắc
void TaskHome(void *pvParameters)
{
    // Khởi tạo SmartHome
    SmartHome_Init(&home, 34); // 34 là pin nút chuyển phòng

    if (!SmartHome_LoadConfig(&home, FILE_CONFIG))
    {
        Serial.println("No config found, creating default");
        SmartHome_AddRoom(&home, "Room1", 27, 26, 25);
        SmartHome_AddRoom(&home, "Room2", -1, 12, 14); // không có cảm biến nhiệt độ
    }
    Serial.println("SmartHome init success");
    vTaskDelay(pdMS_TO_TICKS(2000));

    home.lcd->clear();
    home.lcd->setCursor(3, 0);
    home.lcd->print("V ");
    home.lcd->setCursor(8, 0);
    home.lcd->print("mA");

    home.lcd->setCursor(5, 1);
    home.lcd->print(" T:");
    home.lcd->setCursor(11, 1);
    home.lcd->print(" H:");
    IsSend = true;
    for (;;)
    {
        SmartHome_Update(&home);         // cập nhật sensor và công tắc
        SmartHome_Display(&home);        // hiển thị LCD
        vTaskDelay(pdMS_TO_TICKS(1000)); // 1s
    }
}

void testUDP()
{
    WiFiUDP testUdp;
    testUdp.beginPacket("192.168.1.30", 5683);
    testUdp.print("Hello from ESP32 UDP!");
    testUdp.endPacket();
    Serial.println("Sent raw UDP test packet");
}

// Task Communication: gửi/nhận CoAP
void TaskComm(void *pvParameters)
{
    // Kết nối WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        vTaskDelay(pdMS_TO_TICKS(500));
        Serial.print(".");
    }
    Serial.println();
    Serial.printf("WiFi connected on core %d\n", xPortGetCoreID());
    // Khởi tạo CoAP communication
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
    Communicate_Init(&home);
    static unsigned long lastSend = 0;
    for (;;)
    {
        if (millis() - lastSend > 1000 && IsSend)
        {
            // testUDP();
            Communicate_SendStatus(&home);
            lastSend = millis();
        }
        Communicate_Loop();
        vTaskDelay(pdMS_TO_TICKS(10)); // 0.1s
    }
}

void setup()
{
    Serial.begin(115200);
    Wire.begin();

    // Khởi tạo SPIFFS
    filesystem.Init();

    // Tạo task Home trên Core 1
    xTaskCreatePinnedToCore(TaskHome, "TaskHome", 4096, NULL, 1, NULL, 1);

    // Tạo task Communication trên Core 1
    xTaskCreatePinnedToCore(TaskComm, "TaskComm", 8192, NULL, 15, NULL, 0);
}

void loop()
{
}