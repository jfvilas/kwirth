@REM del .\front\*.* /s /q
@REM del .\bundle.js

@REM xcopy ..\back\bundle\*.* . /s /y
@REM copy  ..\back\bundle.js .

md .\build
del .\build\*.* /s /q

xcopy ..\back\bundle\*.* .\build /s /y

npm run dist
