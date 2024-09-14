set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

rem docker image rm kwirth:latest
docker rmi jfvilasoutlook/kwirth:latest
docker pull jfvilasoutlook/kwirth:%currentversion%
docker tag jfvilasoutlook/kwirth:%currentversion% jfvilasoutlook/kwirth:latest
docker push jfvilasoutlook/kwirth:latest
