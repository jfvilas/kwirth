cd ..\version
call update-version.cmd
cd ..\back

copy ..\version\version.ts ..\back\src
copy ..\version\version.ts ..\front\src
copy ..\version\version.js ..\electron

REM clean targets
del dist\front\*.* /s /q
md  dist\front
del bundle\*.* /s /q
md  bundle
del front\*.* /s /q
md  front
del ..\electron\bundle\*.* /s /q
md  ..\electron\bundle
del ..\external\bundle\*.* /s /q
md  ..\external\bundle
del ..\docker\bundle\*.* /s /q
md  ..\docker\bundle

REM build front (ts) and copy to targets
cd ..\front
call npm run build
cd ..\back

REM bring front SPA here (inside BACK)
xcopy ..\front\build\*.* .\dist\front\*.* /s /y
xcopy ..\front\build\*.* .\front\*.* /s /y
xcopy ..\front\build\*.* .\bundle\front /s /y

REM build back
call npm run build

xcopy .\bundle\*.* ..\electron\bundle /s /y
xcopy .\bundle\*.* ..\external\bundle /s /y
xcopy .\bundle\*.* ..\docker\bundle /s /y
xcopy .\package*.json ..\docker /y