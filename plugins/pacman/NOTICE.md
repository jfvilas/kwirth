# Third parties

## Game

The file `src/front/pacman-game.txt` is the Pac-Man game by **Shaun Williams**
(https://github.com/shaunew/Pac-Man), Copyright © 2012 Shaun Williams,
distributed under the GNU General Public License version 3. The full text is in
`LICENSE.upstream` and must be kept.

Based on the original works of Namco, GCC and Midway. Research by Jamey
Pittman and Bart Grantham.

The game runs inside an iframe in the browser. The original code is not modified;
it is injected as it is into the iframe's `srcdoc`. The only thing added next to it
is a separate script that hands Kwirth's fullscreen shortcut (Ctrl+Alt+F11) to the
page when the game has the keyboard focus.

Because the plugin bundles the game, the plugin as a whole is distributed under the
same license, GPL-3.0-only.

## Name

"Pac-Man" is a registered trademark of Bandai Namco Entertainment. The name is used
here descriptively: there is no Namco art, sound or ROM in the plugin. The code is a
JavaScript reimplementation, equally free of Namco material.

## Rest of the plugin

The rest (channel, back end, UI, iframe machine) is the plugin's own, written for
Kwirth.
