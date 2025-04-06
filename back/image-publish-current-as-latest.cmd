set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

docker build . -t kwirth -t jfvilasoutlook/kwirth:%currentversion% -t  jfvilasoutlook/kwirth:latest
docker push jfvilasoutlook/kwirth:latest
