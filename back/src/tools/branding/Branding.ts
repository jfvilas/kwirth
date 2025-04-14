import { KwirthData, versionGreatThan } from "@jfvilas/kwirth-common"

export const getLastKwirthVersion = async (kwirthData:KwirthData) : Promise<string|undefined> => {
    kwirthData.lastVersion=kwirthData.version
    try {
        var hubResp = await fetch ('https://hub.docker.com/v2/repositories/jfvilasoutlook/kwirth/tags?page_size=25&page=1&ordering=last_updated&name=')
        var json = await hubResp.json()
        if (json) {
            var results=json.results as any[]
            for (var result of results) {
                var regex = /^\d+\.\d+\.\d+$/
                if (regex.test(result.name)) {
                    if (versionGreatThan(result.name, kwirthData.version)) {
                        console.log(`New version available: ${result.name}`)
                        //kwirthData.lastVersion=result.name
                        return result.name
                    }
                }
            }
            console.log('No new Kwirth version found on Docker hub')
        }
    }
    catch (err) {
        console.log('Error trying to determine last Kwirth version')
        console.log(err)
    }
    return undefined
}

export const showLogo = () => {
    console.log('                                                                                                                        ')
    console.log('                                                                                                                        ')
    console.log('                                                 .%#@@@++==@@@@@@@@@-                                                   ')
    console.log('                                              .@*-+%               @@@@                                                 ')
    console.log('                                             #%-.+#                    @@@@                                             ')
    console.log('                                            -%:.=@                   @@@@..*                                            ')
    console.log('                                          :@*::.@  @              @@ @@*@*: =.                                          ')
    console.log('                                           .:...@ .@@              %          @@                                        ')
    console.log('                                         @@@@@@@%*@         :.:+@@#%@@++       @@                                       ')
    console.log('                                        @@       :..@@%%@@@#*++=:....:-=+#%@@=  *-                                      ')
    console.log('                                                  -+:::::...::::::::::::::..:+%#@@-                                     ')
    console.log('                                           .@.=@%+::.::::::::::::::::::::::::.:.-%@*                                    ')
    console.log('                                          :@-%+:..:::::::::::::::::::::::::::::.@ :@                                    ')
    console.log('                                          .@-...::::::::::::::::::::::::::::::: @ %@                                    ')
    console.log('                                            ==.:::::::::::::::::::::::::::::::: @                                       ')
    console.log('                                            .+...::::::::::::::::::::::::::::::.@                                       ')
    console.log('                                            .++=.::::::::::::::::::::::::::::::.%                                       ')
    console.log('                                           =@  ::.:::::::...:::...::::::::......%                                       ')
    console.log('                                          .@.:@@@@@#####%@@*:..=%@@@%##%%@@@@@@%@                                       ')
    console.log('                                        @@                 .@@@%                  =@%@                                  ')
    console.log('                                       .+#.                                     @%+.@@:                                 ')
    console.log('                                       #+:@     @        @  -@  @# @@@@   @@@@@@-:: :@@                                 ')
    console.log('                                        @.-*@@ #@%@@@+=%@@ -%=*##++-  .=#+:.......   @                                  ')
    console.log('                                        @-...@  .........  :=::::::::....:::::::.%@: @                                  ')
    console.log('                                         @.*- .@@+-:-*#%#%@*:::::::::---:-::::::. @=-=                                  ')
    console.log('                                         *::#-  .:=-=::.*= %:::::::::-==-::::::::.:.@                                   ')
    console.log('                                          @:-+:........:=  %:.....:::....::::::::.:*.                                   ')
    console.log('                                          %#*@@=::::::.=@  @@-.=. .:::::::::::::-*@*                                    ')
    console.log('                                            %. =:::::::-*     =@@#.::::::::::::=@                 @@@@@@*               ')
    console.log('  @@@@@@@@@.   @@@@@@@                         --::::...+-@@@@:   .:::::::::::-@                     @@@.               ')
    console.log('     @@@         @@:                           %=:::+*@:: @@@@+ ..::::::::::::@                      @@@.               ')
    console.log('     @@@       @@@                             :-   * @=%#    .++-:.     ..:...        @@@           @@@.               ')
    console.log('     @@@      @@                            .@      .            ..                    @@@           @@@.               ')
    console.log('     @@@    @@@          @@@@@@@@.     @@@ @@@@@@@@@@@@@@@@@@@@=#+:+@@@@@@ +@@@@@   @@@@@@@@@@@*     @@@  =@@@@@@@@     ')
    console.log('     @@@  +@@               @@@       +@@@@.      @:  #    @@@  :..   @@@@@@@  @@      @@@           @@@%@@.    @@@@    ')
    console.log('     @@@.@@                 @@@@      @@@@@  @ . @@        @@@  +:::: @@@@             @@@           @@@@        @@@    ')
    console.log('     @@@=@@@@                @@@     @@ .@@.    @@%       @@@@  .:::: @@@@ =.          @@@           @@@         @@@    ')
    console.log('     @@@  =@@@@              @@@@%@@@@   @@@    @@ -@+    @@@@  ..... @@@@ =  .        @@@           @@@         @@@    ')
    console.log('     @@@    @@@@.             @@@   @%    @@@  @@    %@-   @@@**@@@%@ @@@@ =  @@@@@@@  @@@           @@@         @@@    ')
    console.log('     @@@     .@@@@            @@@@ @@     @@@  @. .@. :@   @@@      % @@@@ +       .   @@@           @@@         @@@    ')
    console.log('     @@@       @@@@@           @@@@@       @@@@@    @. :* =@@@      @ @@@@             @@@           @@@         @@@    ')
    console.log('     @@@         @@@@          @@@@        *@@@      @     @@@      = @@@@             @@@@          @@@         @@@    ')
    console.log('  @@@@@@@@@     @@@@@@@@@       @@@         @@@      @@@@@@@@@@@@   @@@@@@@@@           @@@@@@@=  @@@@@@@@@   @@@@@@@@@ ')
    console.log('                                                                                                                        ')
    console.log('                                              https://jfvilas.github.io/kwirth                                          ')
    console.log('                                                                                                                        ')
    console.log('                                                                                                                        ')    
}