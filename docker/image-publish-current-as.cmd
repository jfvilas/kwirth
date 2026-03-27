set /p major=<..\version\major
set /p minor=<..\version\minor
set /p level=<..\version\level
set currentversion=%major%.%minor%.%level%

docker build . -t kwirth -t jfvilasoutlook/kwirth:%currentversion% -t  jfvilasoutlook/kwirth:%1 -t  jfvilasoutlook/kwirth:%currentversion%
docker push jfvilasoutlook/kwirth:%1
docker push jfvilasoutlook/kwirth:%currentversion%
