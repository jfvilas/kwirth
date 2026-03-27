set /p major=<..\version\major
set /p minor=<..\version\minor
set /p level=<..\version\level
set currentversion=%major%.%minor%.%level%

docker rmi kwirth:latest
docker tag kwirth:%CURRENTVERSION% kwirth:%1
k3d image import kwirth:%1 -c kwirth
