// 단일 스레드, poll() 기반 HTTP + WebSocket 서버.
// - 일반 HTTP GET 요청은 staticDir 의 파일을 서빙 (클라이언트 html/js)
// - Upgrade: websocket 요청은 WebSocket 연결로 전환
#pragma once

#include <chrono>
#include <cstdint>
#include <functional>
#include <string>
#include <unordered_map>

using ConnId = uint32_t;

class WsServer {
public:
    std::function<void(ConnId)> onOpen;
    std::function<void(ConnId, const std::string&)> onMessage;
    std::function<void(ConnId)> onClose;

    WsServer(uint16_t port, std::string staticDir);
    ~WsServer();
    WsServer(const WsServer&) = delete;
    WsServer& operator=(const WsServer&) = delete;

    bool start();

    // 네트워크 이벤트를 처리한다. 최대 timeoutMs 만큼 대기.
    void poll(int timeoutMs);

    // WebSocket 텍스트 메시지 전송 (논블로킹, 내부 버퍼링).
    void send(ConnId id, const std::string& text);
    void close(ConnId id);

    // 접속한 쪽의 IP. 프록시 뒤라면 프록시가 알려준 실제 주소.
    std::string remoteIp(ConnId id) const;

    void setMaxConnectionsPerIp(int limit) { maxConnPerIp_ = limit; }

private:
    using Clock = std::chrono::steady_clock;

    struct Conn {
        int fd = -1;
        ConnId id = 0;
        std::string ip;
        Clock::time_point lastRead;
        Clock::time_point lastPing;
        Clock::time_point closingSince;  // closing 이 된 뒤 처음 확인한 시각 (기본값이면 아직 없음)
        bool isWebSocket = false;
        bool closing = false;  // 쓰기 버퍼를 다 보내면 연결 종료
        bool dead = false;     // 즉시 제거 대상
        std::string in;
        std::string out;
        std::string fragment;  // 분할(continuation) 프레임 조립용
    };

    void acceptAll();
    void readFrom(Conn& c);
    void flush(Conn& c);
    void sweep();
    void expireIdle();

    void handleHttp(Conn& c);
    void serveStatic(Conn& c, const std::string& method, const std::string& target);
    void respondHttp(Conn& c, int status, const std::string& contentType,
                     const std::string& body, bool headOnly = false);

    void handleFrames(Conn& c);
    void sendFrame(Conn& c, uint8_t opcode, const std::string& payload);
    void closeConn(Conn& c, uint16_t code);

    uint16_t port_;
    std::string staticDir_;
    int listenFd_ = -1;
    ConnId nextId_ = 1;
    int maxConnPerIp_ = 16;
    Clock::time_point nextExpiry_;
    std::unordered_map<ConnId, Conn> conns_;
};
