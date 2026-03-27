set /p major=<..\version\major
set /p minor=<..\version\minor
set /p level=<..\version\level
set currentversion=%major%.%minor%.%level%

docker image rm kwirth:%CURRENTVERSION%
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=0
docker build . -t kwirth:%CURRENTVERSION% -t kwirth:latest