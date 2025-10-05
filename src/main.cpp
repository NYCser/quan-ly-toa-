#include <Arduino.h>
#include <WiFi.h>

// #include "FileSystem.h"
#include "home.h"
#include "communicate.h"

// Thay bằng WiFi của bạn
const char *ssid = "IoTVision_2.4GHz";
const char *password = "iotvision@2022";

// SmartHome struct
SmartHome home;
// FFS filesystem;

// Task Home: sensor, LCD, công tắc
void TaskHome(void *pvParameters)
{
    for (;;)
    {
        SmartHome_Update(&home);         // cập nhật sensor và công tắc
        SmartHome_Display(&home);        // hiển thị LCD
        vTaskDelay(pdMS_TO_TICKS(1000)); // 1s
    }
}

// Task Communication: gửi/nhận CoAP
void TaskComm(void *pvParameters)
{
    for (;;)
    {
        Communicate_SendStatus(&home);   // gửi JSON trạng thái
        vTaskDelay(pdMS_TO_TICKS(5000)); // 5s
    }
}

void setup()
{
    Serial.begin(115200);
    Wire.begin();

    // Kết nối WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

    // Khởi tạo SPIFFS
    // filesystem.Init();

    // Khởi tạo SmartHome
    SmartHome_Init(&home, 0); // 34 là pin nút chuyển phòng
    SmartHome_AddRoom(&home, "Room1", 13, 12, 14);
    SmartHome_AddRoom(&home, "Room2", 16, 18, 17);
    Serial.println("SmartHome init success");

    // Khởi tạo CoAP communication
    Communicate_Init(&home);

    // Tạo task Home trên Core 1
    xTaskCreatePinnedToCore(TaskHome, "TaskHome", 4096, NULL, 1, NULL, 1);

    // Tạo task Communication trên Core 1
    xTaskCreatePinnedToCore(TaskComm, "TaskComm", 8192, NULL, 1, NULL, 1);
}

void loop()
{
    coap.loop(); // xử lý callback CoAP
}
