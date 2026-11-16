#include "game/account_data.hpp"

#include <cctype>
#include <cstdlib>

AccountData AccountData::read(const Account& account) {
    AccountData d;
    for (const auto& entry : account.extra) {
        const std::string& key = entry.first;
        const std::string& value = entry.second;
        const int number = std::atoi(value.c_str());
        if (key == "boardOn") d.boardOn = number != 0;
        else if (key == "board") d.boardText = value;
        else if (key == "boardStyle") d.boardStyle = number;
        else if (key == "pets") d.pets = number;
        else if (key == "emotes") d.emotes = number;
        else if (key == "pet") d.pet = number;
        else if (key == "pn") d.petNames = value;
        else if (key == "mates") d.mates = value;
        else if (key == "friends") d.friends = value;
        else if (key == "freq") d.friendReq = value;
        else if (key == "todo") d.todo = value;
        else if (key == "todoShare") d.todoShare = number != 0;
        else if (key == "floors") d.floorsOwned = number;
        else if (key == "stats") d.stats = value;
        else if (key == "goods") d.goods = value;
        else if (key == "eggAt") d.eggAt = std::atol(value.c_str());
        else if (key == "milkAt") d.milkAt = std::atol(value.c_str());
        else if (key == "dye") d.dye = number;
        else if (key == "fd") d.dyed = value;
        else if (key == "gold") d.gold = number;
        else if (key.size() == 2 && key[0] == 'c' && key[1] >= '0' && key[1] < '0' + kFishKinds)
            d.caught[key[1] - '0'] = number;
        else if (key.size() == 2 && key[0] == 'l' && key[1] >= '0' && key[1] < '0' + kLootKinds)
            d.loot[key[1] - '0'] = number;
        else if (key.size() == 2 && key[0] == 's' && key[1] >= '0' && key[1] < '0' + kShopKinds)
            d.shop[key[1] - '0'] = number;
        else if (key.size() >= 2 && key.size() <= 3 && key[0] == 'f' && std::isdigit(static_cast<unsigned char>(key[1])) &&
                 (key.size() == 2 || std::isdigit(static_cast<unsigned char>(key[2])))) {
            const int index = std::atoi(key.c_str() + 1);
            if (index < kDecorKinds) d.furn[index] = number;
        }
    }
    return d;
}

void AccountData::write(Account& a) const {
    for (int i = 0; i < kFishKinds; ++i) a.set("c" + std::to_string(i), std::to_string(caught[i]));
    for (int i = 0; i < kLootKinds; ++i) a.set("l" + std::to_string(i), std::to_string(loot[i]));
    for (int i = 0; i < kShopKinds; ++i) a.set("s" + std::to_string(i), std::to_string(shop[i]));
    for (int i = 0; i < kDecorKinds; ++i) a.set("f" + std::to_string(i), std::to_string(furn[i]));
    a.set("dye", std::to_string(dye));
    a.set("fd", dyed);
    a.set("gold", std::to_string(gold));
    a.set("boardOn", boardOn ? "1" : "0");
    a.set("board", boardText);
    a.set("boardStyle", std::to_string(boardStyle));
    a.set("pets", std::to_string(pets));
    a.set("emotes", std::to_string(emotes));
    a.set("pet", std::to_string(pet));
    a.set("pn", petNames);
    a.set("mates", mates);
    a.set("friends", friends);
    a.set("freq", friendReq);
    a.set("todo", todo);
    a.set("todoShare", todoShare ? "1" : "0");
    a.set("floors", std::to_string(floorsOwned));
    a.set("goods", goods);
    a.set("eggAt", std::to_string(eggAt));
    a.set("milkAt", std::to_string(milkAt));
    a.set("stats", stats);
}
