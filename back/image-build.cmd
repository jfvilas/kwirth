call build

docker image rm kwirth:latest
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=0
docker build . -t kwirth:latest
k3d image import kwirth:latest -c kwirth
