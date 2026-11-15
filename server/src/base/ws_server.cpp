#include "base/ws_server.hpp"

#include "base/sha1.hpp"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <cctype>
#include <cerrno>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <vector>

namespace {

constexpr size_t kMaxHttpHeader = 8 * 1024;
constexpr size_t kMaxInBuffer = 256 * 1024;
constexpr size_t kMaxMessage = 16 * 1024;     // 게임 메시지는 아주 작으므로 넉넉한 상한
constexpr size_t kMaxOutBuffer = 1024 * 1024;  // 이보다 밀리면 느린 클라이언트로 보고 끊음
constexpr size_t kMaxConnections = 1000;
constexpr auto kHttpIdle = std::chrono::seconds(10);   // 요청을 끝까지 보내지 않는 HTTP 연결을 정리한다
constexpr auto kWsPingEvery = std::chrono::seconds(20);
constexpr auto kWsIdle = std::chrono::seconds(60);     // ping 에도 답이 없는 WebSocket 을 정리한다
constexpr auto kCloseGrace = std::chrono::seconds(10); // 닫는 중인 연결이 남은 데이터를 받아 가지 않을 때
const char* kWsGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

bool setNonBlocking(int fd) {
    const int flags = fcntl(fd, F_GETFL, 0);
    return flags >= 0 && fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
}

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return s;
}

std::string trim(const std::string& s) {
    const auto b = s.find_first_not_of(" \t\r\n");
    if (b == std::string::npos) return "";
    const auto e = s.find_last_not_of(" \t\r\n");
    return s.substr(b, e - b + 1);
}

bool endsWith(const std::string& s, const std::string& suffix) {
    return s.size() >= suffix.size() && s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string mimeType(const std::string& path) {
    if (endsWith(path, ".html")) return "text/html; charset=utf-8";
    if (endsWith(path, ".js")) return "text/javascript; charset=utf-8";
    if (endsWith(path, ".css")) return "text/css; charset=utf-8";
    if (endsWith(path, ".json")) return "application/json";
    if (endsWith(path, ".png")) return "image/png";
    if (endsWith(path, ".mp3")) return "audio/mpeg";
    if (endsWith(path, ".woff2")) return "font/woff2";
    if (endsWith(path, ".svg")) return "image/svg+xml";
    return "application/octet-stream";
}

std::string peerIp(const sockaddr_storage& addr) {
    char buf[INET6_ADDRSTRLEN] = {};
    if (addr.ss_family == AF_INET6) {
        inet_ntop(AF_INET6, &reinterpret_cast<const sockaddr_in6*>(&addr)->sin6_addr, buf, sizeof(buf));
    } else if (addr.ss_family == AF_INET) {
        inet_ntop(AF_INET, &reinterpret_cast<const sockaddr_in*>(&addr)->sin_addr, buf, sizeof(buf));
    }
    std::string ip = buf;
    if (ip.rfind("::ffff:", 0) == 0) ip.erase(0, 7);  // 듀얼스택 소켓의 IPv4 주소
    return ip;
}

// 사설망 주소에서 온 연결만 프록시로 믿는다. 인터넷에서 직접 온 연결은 X-Forwarded-For 를 위조할 수 있다.
bool isPrivateIp(const std::string& ip) {
    if (ip == "::1" || ip.rfind("127.", 0) == 0 || ip.rfind("10.", 0) == 0 || ip.rfind("192.168.", 0) == 0 ||
        ip.rfind("fc", 0) == 0 || ip.rfind("fd", 0) == 0)
        return true;
    if (ip.rfind("172.", 0) == 0) {
        const int second = std::atoi(ip.c_str() + 4);
        return second >= 16 && second <= 31;
    }
    return false;
}

const char* statusText(int status) {
    switch (status) {
        case 200: return "OK";
        case 400: return "Bad Request";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 429: return "Too Many Requests";
        default: return "Error";
    }
}

}  // namespace

WsServer::WsServer(uint16_t port, std::string staticDir)
    : port_(port), staticDir_(std::move(staticDir)) {}

WsServer::~WsServer() {
    for (auto& entry : conns_) ::close(entry.second.fd);
    if (listenFd_ >= 0) ::close(listenFd_);
}

bool WsServer::start() {
    std::signal(SIGPIPE, SIG_IGN);  // 끊긴 소켓에 write 해도 프로세스가 죽지 않게

    // IPv6 듀얼스택 소켓: ::1 과 127.0.0.1 (localhost 양쪽) 모두 받는다.
    listenFd_ = ::socket(AF_INET6, SOCK_STREAM, 0);
    if (listenFd_ < 0) {
        std::perror("socket");
        return false;
    }
    int yes = 1, no = 0;
    setsockopt(listenFd_, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
    setsockopt(listenFd_, IPPROTO_IPV6, IPV6_V6ONLY, &no, sizeof(no));

    sockaddr_in6 addr{};
    addr.sin6_family = AF_INET6;
    addr.sin6_addr = in6addr_any;
    addr.sin6_port = htons(port_);
    if (::bind(listenFd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::perror("bind");
        return false;
    }
    if (::listen(listenFd_, 128) < 0) {
        std::perror("listen");
        return false;
    }
    return setNonBlocking(listenFd_);
}

void WsServer::poll(int timeoutMs) {
    std::vector<pollfd> fds;
    std::vector<ConnId> ids;
    fds.reserve(conns_.size() + 1);
    ids.reserve(conns_.size());

    fds.push_back({listenFd_, POLLIN, 0});
    for (auto& entry : conns_) {
        short events = POLLIN;
        if (!entry.second.out.empty()) events |= POLLOUT;
        fds.push_back({entry.second.fd, events, 0});
        ids.push_back(entry.first);
    }

    const int n = ::poll(fds.data(), static_cast<nfds_t>(fds.size()), timeoutMs);
    if (n < 0 && errno != EINTR) std::perror("poll");

    if (n > 0) {
        for (size_t i = 0; i < ids.size(); ++i) {
            auto it = conns_.find(ids[i]);
            if (it == conns_.end()) continue;
            Conn& c = it->second;
            const short re = fds[i + 1].revents;
            if (re & POLLNVAL) c.dead = true;
            if (!c.dead && (re & (POLLIN | POLLHUP | POLLERR))) readFrom(c);
            if (!c.dead && (re & POLLOUT)) flush(c);
        }
        if (fds[0].revents & POLLIN) acceptAll();
    }
    expireIdle();
    sweep();
}

// 1초에 한 번씩 멈춘 연결을 정리하고, WebSocket 에는 ping 을 보내 살아 있는지 확인한다.
// 브라우저는 ping 에 자동으로 답하므로 가만히 있는 플레이어는 끊기지 않는다.
void WsServer::expireIdle() {
    const auto now = Clock::now();
    if (now < nextExpiry_) return;
    nextExpiry_ = now + std::chrono::seconds(1);

    for (auto& entry : conns_) {
        Conn& c = entry.second;
        if (c.dead) continue;
        if (c.closing) {
            if (c.closingSince == Clock::time_point{}) c.closingSince = now;
            else if (now - c.closingSince > kCloseGrace) c.dead = true;
        } else if (!c.isWebSocket) {
            if (now - c.lastRead > kHttpIdle) c.dead = true;
        } else if (now - c.lastRead > kWsIdle) {
            c.dead = true;
        } else if (now - c.lastPing > kWsPingEvery) {
            c.lastPing = now;
            sendFrame(c, 0x9, "");
        }
    }
}

void WsServer::acceptAll() {
    while (true) {
        sockaddr_storage addr{};
        socklen_t len = sizeof(addr);
        const int fd = ::accept(listenFd_, reinterpret_cast<sockaddr*>(&addr), &len);
        if (fd < 0) {
            if (errno == EINTR) continue;
            return;  // EAGAIN: 더 이상 대기 중인 연결 없음
        }
        if (conns_.size() >= kMaxConnections || !setNonBlocking(fd)) {
            ::close(fd);
            continue;
        }
        int one = 1;
        setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));  // 작은 패킷 지연 방지

        Conn c;
        c.fd = fd;
        c.id = nextId_++;
        c.ip = peerIp(addr);
        c.lastRead = Clock::now();
        c.lastPing = c.lastRead;
        conns_.emplace(c.id, std::move(c));
    }
}

void WsServer::readFrom(Conn& c) {
    char buf[4096];
    while (true) {
        const ssize_t r = ::recv(c.fd, buf, sizeof(buf), 0);
        if (r > 0) {
            c.lastRead = Clock::now();
            if (c.closing) continue;  // 닫는 중에 들어온 데이터는 버린다. 쌓인 응답으로 메모리를 채우지 못하게
            c.in.append(buf, static_cast<size_t>(r));
            if (c.in.size() > kMaxInBuffer) {
                c.dead = true;
                return;
            }
            continue;
        }
        if (r == 0) {  // 상대가 연결을 닫음
            c.dead = true;
            return;
        }
        if (errno == EINTR) continue;
        if (errno == EAGAIN || errno == EWOULDBLOCK) break;
        c.dead = true;
        return;
    }

    if (c.closing) {  // HTTP 는 연결당 응답 하나다. 이어 붙인 요청은 처리하지 않는다
        c.in.clear();
        return;
    }
    if (!c.isWebSocket) handleHttp(c);
    if (c.closing) c.in.clear();
    if (c.isWebSocket && !c.dead && !c.closing) handleFrames(c);
}

void WsServer::flush(Conn& c) {
    while (!c.out.empty()) {
        const ssize_t w = ::send(c.fd, c.out.data(), c.out.size(), 0);
        if (w > 0) {
            c.out.erase(0, static_cast<size_t>(w));
            continue;
        }
        if (w < 0 && errno == EINTR) continue;
        if (w < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return;  // 다음 POLLOUT 때 이어서
        c.dead = true;
        return;
    }
}

void WsServer::sweep() {
    std::vector<ConnId> toRemove;
    for (auto& entry : conns_) {
        const Conn& c = entry.second;
        if (c.dead || (c.closing && c.out.empty())) toRemove.push_back(entry.first);
    }
    for (ConnId id : toRemove) {
        auto it = conns_.find(id);
        const bool wasWebSocket = it->second.isWebSocket;
        ::close(it->second.fd);
        conns_.erase(it);
        if (wasWebSocket && onClose) onClose(id);
    }
}

// ---------------------------------------------------------------- HTTP

void WsServer::handleHttp(Conn& c) {
    const size_t headerEnd = c.in.find("\r\n\r\n");
    if (headerEnd == std::string::npos) {
        if (c.in.size() > kMaxHttpHeader) c.dead = true;
        return;
    }
    const std::string header = c.in.substr(0, headerEnd);
    c.in.erase(0, headerEnd + 4);

    std::istringstream ss(header);
    std::string requestLine;
    std::getline(ss, requestLine);
    std::istringstream rl(requestLine);
    std::string method, target, version;
    rl >> method >> target >> version;

    std::unordered_map<std::string, std::string> headers;
    std::string line;
    while (std::getline(ss, line)) {
        const auto colon = line.find(':');
        if (colon == std::string::npos) continue;
        headers[toLower(trim(line.substr(0, colon)))] = trim(line.substr(colon + 1));
    }

    const auto upgrade = headers.find("upgrade");
    if (upgrade != headers.end() && toLower(upgrade->second) == "websocket") {
        const auto key = headers.find("sec-websocket-key");
        if (method != "GET" || key == headers.end()) {
            respondHttp(c, 400, "text/plain", "Bad WebSocket handshake");
            return;
        }
        const auto forwarded = headers.find("x-forwarded-for");
        if (forwarded != headers.end() && isPrivateIp(c.ip)) {
            // 프록시가 맨 끝에 덧붙인 값이 프록시가 직접 본 주소다.
            const auto comma = forwarded->second.rfind(',');
            c.ip = trim(comma == std::string::npos ? forwarded->second : forwarded->second.substr(comma + 1));
        }
        const auto sameIp = std::count_if(conns_.begin(), conns_.end(), [&c](const auto& entry) {
            return entry.second.isWebSocket && !entry.second.dead && entry.second.ip == c.ip;
        });
        if (sameIp >= maxConnPerIp_) {
            respondHttp(c, 429, "text/plain", "Too Many Connections");
            return;
        }
        const std::string accept = util::base64(util::sha1(key->second + kWsGuid));
        c.out += "HTTP/1.1 101 Switching Protocols\r\n"
                 "Upgrade: websocket\r\n"
                 "Connection: Upgrade\r\n"
                 "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
        flush(c);
        c.isWebSocket = true;
        if (onOpen) onOpen(c.id);
        return;
    }

    serveStatic(c, method, target);
}

void WsServer::serveStatic(Conn& c, const std::string& method, const std::string& target) {
    if (method != "GET" && method != "HEAD") {
        respondHttp(c, 405, "text/plain", "Method Not Allowed");
        return;
    }
    std::string path = target.substr(0, target.find('?'));
    if (path.empty() || path[0] != '/' || path.find("..") != std::string::npos) {
        respondHttp(c, 400, "text/plain", "Bad Request");
        return;
    }
    if (path.back() == '/') path += "index.html";

    const std::string fullPath = staticDir_ + path;
    struct stat st {};
    if (::stat(fullPath.c_str(), &st) != 0 || !S_ISREG(st.st_mode)) {
        respondHttp(c, 404, "text/plain", "Not Found");
        return;
    }
    std::ifstream file(fullPath, std::ios::binary);
    std::ostringstream body;
    body << file.rdbuf();
    respondHttp(c, 200, mimeType(path), body.str(), method == "HEAD");
}

void WsServer::respondHttp(Conn& c, int status, const std::string& contentType,
                           const std::string& body, bool headOnly) {
    c.out += "HTTP/1.1 " + std::to_string(status) + " " + statusText(status) + "\r\n" +
             "Content-Type: " + contentType + "\r\n" +
             "Content-Length: " + std::to_string(body.size()) + "\r\n" +
             "Cache-Control: no-cache\r\n"
             "Connection: close\r\n\r\n";
    if (!headOnly) c.out += body;
    c.closing = true;
    flush(c);
}

// ----------------------------------------------------------- WebSocket

void WsServer::handleFrames(Conn& c) {
    while (!c.dead && !c.closing) {
        if (c.in.size() < 2) return;
        const auto* p = reinterpret_cast<const uint8_t*>(c.in.data());
        const bool fin = (p[0] & 0x80) != 0;
        const uint8_t opcode = p[0] & 0x0F;
        const bool masked = (p[1] & 0x80) != 0;
        uint64_t len = p[1] & 0x7F;
        size_t pos = 2;

        if (len == 126) {
            if (c.in.size() < 4) return;
            len = (uint64_t(p[2]) << 8) | p[3];
            pos = 4;
        } else if (len == 127) {
            if (c.in.size() < 10) return;
            len = 0;
            for (int i = 0; i < 8; ++i) len = (len << 8) | p[2 + i];
            pos = 10;
        }
        // 클라이언트 → 서버 프레임은 반드시 마스킹되어야 함 (RFC 6455)
        if (!masked || len > kMaxMessage) {
            closeConn(c, 1002);
            return;
        }
        if (c.in.size() < pos + 4 + len) return;  // 프레임이 아직 다 안 옴

        const uint8_t mask[4] = {p[pos], p[pos + 1], p[pos + 2], p[pos + 3]};
        pos += 4;
        std::string payload = c.in.substr(pos, static_cast<size_t>(len));
        for (size_t i = 0; i < payload.size(); ++i) payload[i] = static_cast<char>(payload[i] ^ mask[i % 4]);
        c.in.erase(0, pos + static_cast<size_t>(len));

        switch (opcode) {
            case 0x0:  // continuation
                c.fragment += payload;
                if (c.fragment.size() > kMaxMessage) {
                    closeConn(c, 1009);
                    return;
                }
                if (fin) {
                    std::string msg;
                    msg.swap(c.fragment);
                    if (onMessage) onMessage(c.id, msg);
                }
                break;
            case 0x1:  // text
            case 0x2:  // binary
                if (fin) {
                    if (onMessage) onMessage(c.id, payload);
                } else {
                    c.fragment = std::move(payload);
                }
                break;
            case 0x8:  // close
                sendFrame(c, 0x8, payload.substr(0, 2));
                c.closing = true;
                return;
            case 0x9:  // ping
                sendFrame(c, 0xA, payload);
                break;
            case 0xA:  // pong
                break;
            default:
                closeConn(c, 1002);
                return;
        }
    }
}

void WsServer::sendFrame(Conn& c, uint8_t opcode, const std::string& payload) {
    std::string frame;
    frame.push_back(static_cast<char>(0x80 | opcode));  // FIN + opcode, 서버→클라이언트는 마스킹 안 함
    const uint64_t len = payload.size();
    if (len < 126) {
        frame.push_back(static_cast<char>(len));
    } else if (len <= 0xFFFF) {
        frame.push_back(static_cast<char>(126));
        frame.push_back(static_cast<char>((len >> 8) & 0xFF));
        frame.push_back(static_cast<char>(len & 0xFF));
    } else {
        frame.push_back(static_cast<char>(127));
        for (int i = 7; i >= 0; --i) frame.push_back(static_cast<char>((len >> (i * 8)) & 0xFF));
    }
    c.out += frame;
    c.out += payload;
    if (c.out.size() > kMaxOutBuffer) {
        c.dead = true;
        return;
    }
    flush(c);
}

void WsServer::closeConn(Conn& c, uint16_t code) {
    if (c.closing || c.dead) return;
    std::string payload;
    payload.push_back(static_cast<char>((code >> 8) & 0xFF));
    payload.push_back(static_cast<char>(code & 0xFF));
    sendFrame(c, 0x8, payload);
    c.closing = true;
}

void WsServer::send(ConnId id, const std::string& text) {
    auto it = conns_.find(id);
    if (it == conns_.end()) return;
    Conn& c = it->second;
    if (!c.isWebSocket || c.dead || c.closing) return;
    sendFrame(c, 0x1, text);
}

void WsServer::close(ConnId id) {
    auto it = conns_.find(id);
    if (it != conns_.end()) closeConn(it->second, 1000);
}

std::string WsServer::remoteIp(ConnId id) const {
    const auto it = conns_.find(id);
    return it == conns_.end() ? std::string() : it->second.ip;
}
