# 모듈 예시 서버(hello_server): server-core 의 소스와 이 폴더의 예시 모듈을 함께 빌드한다.
CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -pedantic -pthread
CORE = ../..
CPPFLAGS += -I. -I$(CORE)/src -MMD -MP

CORE_SRCS := $(shell find $(CORE)/src/base $(CORE)/src/core -name '*.cpp' | sort)
OBJS := $(CORE_SRCS:$(CORE)/src/%.cpp=build/core/%.o) build/example.o build/main.o
TARGET = hello_server

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $(OBJS)

build/core/%.o: $(CORE)/src/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

build/%.o: %.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c -o $@ $<

-include $(OBJS:.o=.d)

run: $(TARGET)
	./$(TARGET) 8080 ../../../client ./data

clean:
	rm -rf build $(TARGET) data

.PHONY: run clean
