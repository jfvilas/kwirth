set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

rem docker image rm kwirth:latest
docker build . -t kwirth -t jfvilasoutlook/kwirth:%currentversion% -t  jfvilasoutlook/kwirth:develop
rem docker push jfvilasoutlook/kwirth:%currentversion%
rem docker login -u xxx -p yyy
docker push jfvilasoutlook/kwirth:develop
