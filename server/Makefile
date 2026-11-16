# 이 게임 서버(mmo_server): server-core 의 소스와 이 폴더의 콘텐츠를 함께 빌드한다.
CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -pedantic -pthread
CORE = ../server-core
# include 는 src/ 에서 본 경로로 쓴다. core 의 것은 core/…, base/…, 이 게임의 것은 game/…, home/… 처럼
CPPFLAGS += -Isrc -I$(CORE)/src -MMD -MP

# server-core 의 base, core 와 이 폴더의 src/ 아래 .cpp 를 모두 빌드한다. 새 파일을 더해도 이 목록을 고칠 필요가 없다.
CORE_SRCS := $(shell find $(CORE)/src/base $(CORE)/src/core -name '*.cpp' | sort)
GAME_SRCS := $(shell find src -name '*.cpp' | sort)
OBJS := $(CORE_SRCS:$(CORE)/src/%.cpp=build/core/%.o) $(GAME_SRCS:src/%.cpp=build/game/%.o)
TARGET = mmo_server

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $(OBJS)

build/core/%.o: $(CORE)/src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

build/game/%.o: src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

-include $(OBJS:.o=.d)

run: $(TARGET)
	./$(TARGET) 8080 ../client ./data

clean:
	rm -rf build $(TARGET)

.PHONY: run clean
