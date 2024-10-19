call update-version.cmd

REM build back
call npm run build
@REM del dist\front\*.* /s /q
@REM md dist\front

REM build front (tsc)
@REM xcopy src\version.ts ..\front\src\version.ts /y
@REM cd ..\front
@REM call npm run build
@REM xcopy build\*.* ..\back\dist\front\*.* /s /y
@REM cd ..\back
