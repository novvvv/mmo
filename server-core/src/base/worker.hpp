// 게임 루프를 멈추면 안 되는 느린 작업(비밀번호 해시, 파일 저장)을 처리하는 작업 스레드.
// 작업이 끝난 뒤의 처리는 finish() 로 메인 스레드에 돌려주고, drain() 에서 실행한다.
#pragma once

#include <atomic>
#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <vector>

class Worker {
public:
    using Task = std::function<void()>;

    Worker() : thread_([this] { run(); }) {}

    // 대기 중인 작업을 모두 끝낸 뒤 종료한다 (종료 직전의 저장이 유실되지 않게).
    ~Worker() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stop_ = true;
        }
        wake_.notify_all();
        thread_.join();
    }

    Worker(const Worker&) = delete;
    Worker& operator=(const Worker&) = delete;

    // 종료 직전에 호출한다. 아직 시작하지 않은 비밀번호 해시를 건너뛰어 저장이 먼저 끝나게 한다.
    void skipHeavyWork() { skipHeavy_ = true; }
    bool heavyWorkSkipped() const { return skipHeavy_; }

    void post(Task task) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            tasks_.push_back(std::move(task));
        }
        wake_.notify_one();
    }

    // 작업 스레드에서 호출: 메인 스레드에서 실행할 후속 처리를 등록한다.
    void finish(Task done) {
        std::lock_guard<std::mutex> lock(mutex_);
        done_.push_back(std::move(done));
    }

    // 메인 스레드에서 호출: 끝난 작업의 후속 처리를 실행한다.
    void drain() {
        std::vector<Task> ready;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            ready.swap(done_);
        }
        for (const Task& task : ready) task();
    }

private:
    void run() {
        while (true) {
            Task task;
            {
                std::unique_lock<std::mutex> lock(mutex_);
                wake_.wait(lock, [this] { return stop_ || !tasks_.empty(); });
                if (tasks_.empty()) return;  // stop_ 이고 남은 작업이 없을 때만 종료
                task = std::move(tasks_.front());
                tasks_.pop_front();
            }
            task();
        }
    }

    std::mutex mutex_;
    std::condition_variable wake_;
    std::deque<Task> tasks_;
    std::vector<Task> done_;
    bool stop_ = false;
    std::atomic<bool> skipHeavy_{false};
    std::thread thread_;  // 다른 멤버가 준비된 뒤 시작되도록 마지막에 둔다
};
