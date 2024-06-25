call update-version.cmd

REM build back
call npm run build
del dist\front\*.* /s /q
md dist\front

REM build front
xcopy src\version.ts ..\front\src\version.ts /y
cd ..\front
call npm run build
xcopy build\*.* ..\back\dist\front\*.* /s /y
cd ..\back
