set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

docker rmi kwirth:latest
docker tag kwirth:%CURRENTVERSION% kwirth:latest
k3d image import kwirth:%CURRENTVERSION% -c kwirth
k3d image import kwirth:latest -c kwirth