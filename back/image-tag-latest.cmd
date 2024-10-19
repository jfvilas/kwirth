set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

docker rmi kwirth:latest
docker rmi jfvilasoutlook/kwirth:latest
docker tag kwirth:%currentversion% kwirth:latest
docker tag kwirth:%currentversion% jfvilasoutlook/kwirth:latest
docker tag kwirth:%currentversion% jfvilasoutlook/kwirth:%currentversion%
docker push jfvilasoutlook/kwirth:latest
docker push jfvilasoutlook/kwirth:%currentversion%