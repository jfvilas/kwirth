call build

set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

docker image rm kwirth:%CURRENTVERSION%
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=0
docker build . -t kwirth:%CURRENTVERSION%
