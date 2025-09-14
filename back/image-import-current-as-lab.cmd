set /p major=<major
set /p minor=<minor
set /p level=<level
set currentversion=%major%.%minor%.%level%

docker rmi kwirth:lab
docker tag kwirth:%CURRENTVERSION% kwirth:lab
k3d image import kwirth:lab -c kwirth
