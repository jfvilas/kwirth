md .\build
del .\build\*.* /s /q

xcopy ..\back\bundle\*.* .\build /s /y

npm run dist
