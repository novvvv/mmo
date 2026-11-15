# 빌드 단계를 분리해 최종 이미지에는 컴파일러가 들어가지 않게 한다.
FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ make
WORKDIR /src
COPY server/ .
# 같은 서버의 다른 서비스가 느려지지 않도록 낮은 우선순위로 컴파일한다.
RUN nice -n 19 make

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /src/mmo_server .
COPY client/ client/
# 계정 데이터는 볼륨에 둬서 컨테이너를 다시 만들어도 남게 한다.
RUN mkdir -p /data && chown nobody:nogroup /data
VOLUME /data
USER nobody
EXPOSE 8080
CMD ["./mmo_server", "8080", "./client", "/data"]
