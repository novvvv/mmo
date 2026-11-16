// core 의 플레이어 표(연결 번호 → PlayerBase)를 이 게임의 Player 타입으로 보는 창.
// core 는 플레이어를 PlayerBase 로 갖고 있지만, 이 게임은 Game::makePlayer 로 Player 를 만들어 넣으므로 모두 Player 다.
// 표처럼 쓸 수 있게 find, begin, end, count, size 를 흉내 낸다: entry.first 는 연결 번호, entry.second 는 Player&.
#pragma once

#include "core/core.hpp"

#include <cstddef>
#include <iterator>
#include <optional>

template <class P>
class PlayerView {
public:
    using Map = Core::PlayerMap;

    struct Entry {
        ConnId first;
        P& second;
    };

    class iterator {
    public:
        using iterator_category = std::forward_iterator_tag;
        using value_type = Entry;
        using difference_type = std::ptrdiff_t;
        using pointer = Entry*;
        using reference = Entry&;

        iterator() = default;
        explicit iterator(typename Map::iterator it) : it_(it) {}
        iterator(const iterator& other) : it_(other.it_) {}
        iterator& operator=(const iterator& other) {
            it_ = other.it_;
            entry_.reset();
            return *this;
        }
        Entry& operator*() const {
            entry_.emplace(Entry{it_->first, static_cast<P&>(*it_->second)});
            return *entry_;
        }
        Entry* operator->() const { return &**this; }
        iterator& operator++() {
            ++it_;
            return *this;
        }
        iterator operator++(int) {
            iterator old = *this;
            ++it_;
            return old;
        }
        bool operator==(const iterator& other) const { return it_ == other.it_; }
        bool operator!=(const iterator& other) const { return it_ != other.it_; }

    private:
        typename Map::iterator it_{};
        mutable std::optional<Entry> entry_;
    };

    explicit PlayerView(Map& map) : map_(&map) {}

    iterator begin() const { return iterator(map_->begin()); }
    iterator end() const { return iterator(map_->end()); }
    iterator find(ConnId id) const { return iterator(map_->find(id)); }
    size_t count(ConnId id) const { return map_->count(id); }
    size_t size() const { return map_->size(); }
    bool empty() const { return map_->empty(); }

private:
    Map* map_;
};
