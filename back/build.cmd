call update-version.cmd


REM build front (ts)
del dist\front\*.* /s /q
md dist\front
xcopy src\version.ts ..\front\src\version.ts /y
cd ..\front
call npm run build
xcopy build\*.* ..\back\dist\front\*.* /s /y
cd ..\back

REM build back
call npm run build
