# server-core 만으로 최소 서버(core_server)를 빌드한다. 콘텐츠가 있는 서버는 server/Makefile 이 이 폴더의 소스를 함께 빌드한다.
CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -pedantic -pthread
CPPFLAGS += -Isrc -MMD -MP

SRCS := $(shell find src/base src/core src/minimal -name '*.cpp' | sort)
OBJS := $(SRCS:src/%.cpp=build/%.o)
TARGET = core_server

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $(OBJS)

build/%.o: src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

-include $(OBJS:.o=.d)

run: $(TARGET)
	./$(TARGET) 8080 ../client ./data

clean:
	rm -rf build $(TARGET)

.PHONY: run clean
