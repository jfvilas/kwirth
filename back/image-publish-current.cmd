set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

rem docker image rm kwirth:latest
docker build . -t kwirth -t jfvilasoutlook/kwirth:%currentversion%
docker push jfvilasoutlook/kwirth:%currentversion%
