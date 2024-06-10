call update-version.cmd

REM build back
call npm run build
md dist\front

REM build front
cd ..\front
call npm run build
xcopy build\*.* ..\back\dist\front\*.* /s /y
cd ..\back
