@echo off
set /p major=<major
set /p minor=<minor
set /p level=<level
set currversion=%major%.%minor%.%level%
set /a level=%level%+1
echo %level% > level
set nextversion=%major%.%minor%.%level%
echo %currversion% to %nextversion%
echo export const VERSION:string="%nextversion%"; > src\version.ts
