CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -pedantic -pthread
# include 는 src/ 에서 본 경로로 쓴다 (예: #include "net/ws_server.hpp")
CPPFLAGS += -Isrc -MMD -MP

# src/ 아래의 .cpp 를 모두 빌드한다. 새 파일을 더해도 이 목록을 고칠 필요가 없다.
SRCS := $(shell find src -name '*.cpp' | sort)
OBJS := $(SRCS:src/%.cpp=build/%.o)
TARGET = mmo_server

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $(OBJS)

# 헤더가 바뀌면 그 헤더를 포함한 파일만 다시 빌드한다 (-MMD 가 만드는 .d 파일)
build/%.o: src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

-include $(OBJS:.o=.d)

run: $(TARGET)
	./$(TARGET) 8080 ../client ./data

clean:
	rm -rf build $(TARGET)

.PHONY: run clean
