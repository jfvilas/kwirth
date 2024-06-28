call update-version.cmd

REM build back
call npm run build
del dist\front\*.* /s /q
md dist\front

REM build front (ts)
xcopy src\version.ts ..\front\src\version.ts /y
cd ..\front
call npm run build
xcopy build\*.* ..\back\dist\front\*.* /s /y
cd ..\back

REM build front (webpack)
@REM xcopy src\version.ts ..\front\src\version.ts /y
@REM cd ..\front
@REM call npm run wpbuild
@REM xcopy dist\*.* ..\back\dist\front\*.* /s /y
@REM cd ..\back
