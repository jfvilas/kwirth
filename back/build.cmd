call update-version.cmd

REM clean targets
del dist\front\*.* /s /q
md  dist\front
del bundle\*.* /s /q
md  bundle
del front\*.* /s /q
md  front
del ..\electron\bundle\*.* /s /q
md  ..\electron\bundle

REM build front (ts) and copy to targets
cd ..\front
call npm run build
cd ..\back

xcopy ..\front\build\*.* .\dist\front\*.* /s /y
xcopy ..\front\build\*.* .\front\*.* /s /y
xcopy ..\front\build\*.* .\bundle\front /s /y

REM build back
call npm run build

xcopy .\bundle\*.* ..\electron\bundle /s /y
