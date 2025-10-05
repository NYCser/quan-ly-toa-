#include "home.h"
Adafruit_INA219 ina219;
void SmartHome_Init(SmartHome *home, int buttonPin)
{
    home->roomCount = 0;
    home->currentRoom = 0;
    home->buttonPin = buttonPin;

    pinMode(buttonPin, INPUT_PULLUP);

    // init LCD
    home->lcd = new LiquidCrystal_I2C(0x27, 16, 2);
    home->lcd->init();
    home->lcd->backlight();

    home->lcd->clear();
    home->lcd->setCursor(3, 0);
    home->lcd->print("Smart Home");

    if (!home->ina219.begin())
    {
        while (1)
        {
            delay(10);
        }
    }
}

bool SmartHome_AddRoom(SmartHome *home, const char *name,
                       int dhtPin, int lightPin, int fanPin)
{
    if (home->roomCount >= MAX_ROOMS)
        return false;

    Room *room = &home->rooms[home->roomCount];
    strncpy(room->name, name, MAX_NAME_LEN);
    room->name[MAX_NAME_LEN - 1] = '\0';
    room->dhtPin = dhtPin;
    room->lightPin = lightPin;
    room->fanPin = fanPin;
    room->lightState = false;
    room->fanState = false;

    if (dhtPin >= 0)
    {
        room->dht = new DHT(dhtPin, DHT11);
        room->dht->begin();
    }
    else
    {
        room->dht = NULL;
    }

    if (lightPin >= 0)
        pinMode(lightPin, OUTPUT);
    if (fanPin >= 0)
        pinMode(fanPin, OUTPUT);
    home->roomCount++;
    return true;
}

void SmartHome_RemoveRoom(SmartHome *home, const char *name)
{
    for (int i = 0; i < home->roomCount; i++)
    {
        if (strcmp(home->rooms[i].name, name) == 0)
        {
            for (int j = i; j < home->roomCount - 1; j++)
            {
                home->rooms[j] = home->rooms[j + 1];
            }
            home->roomCount--;
            break;
        }
    }
}

void SmartHome_ControlDevice(Room *room, const char *device, bool state)
{
    if (strcmp(device, "light") == 0 && room->lightPin >= 0)
    {
        digitalWrite(room->lightPin, state ? HIGH : LOW);
        room->lightState = state;
    }
    if (strcmp(device, "fan") == 0 && room->fanPin >= 0)
    {
        digitalWrite(room->fanPin, state ? HIGH : LOW);
        room->fanState = state;
    }
}

void SmartHome_Update(SmartHome *home)
{
    if (home->roomCount == 0)
        return;
    for (int i = 0; i < home->roomCount; i++)
    {
        home->rooms[i].temp = home->rooms[i].dht->readTemperature();
        home->rooms[i].humi = home->rooms[i].dht->readHumidity();
        if (isnan(home->rooms[i].temp) || isnan(home->rooms[i].humi))
        {
            home->rooms[i].temp = 0;
            home->rooms[i].humi = 0;
        }
    }

    // check nút đổi phòng
    // if (digitalRead(home->buttonPin) == LOW)
    // {
    //     SmartHome_NextRoom(home);
    // }
}

void SmartHome_Display(SmartHome *home)
{
    if (home->roomCount == 0)
        return;

    float busVoltage = home->ina219.getBusVoltage_V();
    float current_mA = home->ina219.getCurrent_mA();
    float power_mW = home->ina219.getPower_mW();

    Room *room = &home->rooms[home->currentRoom];

    home->lcd->clear();
    home->lcd->setCursor(0, 0);
    home->lcd->print(busVoltage, 1);
    home->lcd->print("V ");
    home->lcd->print(current_mA, 0);
    home->lcd->print("mA");

    home->lcd->setCursor(0, 1);
    home->lcd->print(room->name);
    home->lcd->print(" T:");
    home->lcd->print(room->temp, 0);
    home->lcd->print("C H:");
    home->lcd->print(room->humi, 0);
}

void SmartHome_NextRoom(SmartHome *home)
{
    if (home->roomCount == 0)
        return;
    home->currentRoom = (home->currentRoom + 1) % home->roomCount;
}
