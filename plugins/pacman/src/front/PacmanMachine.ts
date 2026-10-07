/**
 * PacmanMachine — manager for the iframe that survives tab switches.
 *
 * The Pac-Man game is a JavaScript IIFE (Shaun Williams, GPL v3) that runs
 * in an iframe to isolate its code from Kwirth's React/MUI. It uses two canvases:
 * `canvas` (visible) and `atlas` (hidden, a procedurally generated sprite atlas).
 *
 * The JS is bundled as text into front.js (imported as .txt) and injected
 * into the iframe's HTML via srcdoc.
 *
 * Machine pattern that survives tab switches (like GalagaMachine):
 * - The host <div> is position:fixed on document.body, never removed.
 * - attach(anchor) repositions the div over the anchor and shows it.
 * - detach() hides the div.
 * - only dispose() (from stopChannel) destroys the iframe.
 */

// The game JavaScript (bundled as text, inlined into the iframe via srcdoc)
import pacmanGame from './pacman-game.txt'
import { IPacmanGameState } from '../common/PacmanTypes'

/** What the iframe posts when it swallowed Kwirth's fullscreen shortcut. */
const FORWARD_KEY_MESSAGE = 'pacman-forward-key'
/** What the bridge posts with the game's state, and what the page sends it to pause or resume. */
const STATE_MESSAGE = 'pacman-state'
const PAUSE_MESSAGE = 'pacman-pause'

/*
    The game keeps its whole state inside one closure — `(function(){ ... })();` — so nothing outside can
    read the score, nor pause it. This bridge is appended INSIDE that closure, right before it closes, where
    getScore(), extraLives, level, state, overState and executive are in scope. It reports the state when
    it changes and obeys the pause the channel asks for. It is the only change made to the game.
*/
const BRIDGE_SCRIPT = `
;(function () {
    var last = "";
    setInterval(function () {
        try {
            var s = { type: "${STATE_MESSAGE}", score: getScore(), lives: extraLives === Infinity ? -1 : extraLives, level: level, over: state === overState };
            var key = JSON.stringify(s);
            if (key !== last) { last = key; window.parent.postMessage(s, "*"); }
        } catch (e) { }
    }, 250);
    window.addEventListener("message", function (e) {
        if (e.source !== window.parent || !e.data || e.data.type !== "${PAUSE_MESSAGE}") return;
        if (executive.isPaused() !== !!e.data.paused) executive.togglePause();
    });
})();
`

/** Where the game's closure ends: the bridge goes right before it. */
const GAME_CLOSURE_END = '})();'

/**
 * The game with the bridge inside its closure. If the closure end is not where it is expected (a different
 * copy of the game), the game is served untouched: it plays, but scores and pause do not reach the plugin.
 */
export const withBridge = (gameJs: string): string => {
    const at = gameJs.lastIndexOf(GAME_CLOSURE_END)
    if (at < 0) return gameJs
    return gameJs.slice(0, at) + BRIDGE_SCRIPT + gameJs.slice(at)
}

/*
    The iframe keeps the keyboard focus while the game is played, so a key pressed there never reaches the
    page — and Kwirth's fullscreen shortcut (Ctrl+Alt+F11) lives there. This runs BEFORE the game, which is
    left untouched, and hands that one combination, and only that one, to the parent.
*/
const FORWARD_KEY_SCRIPT = `
window.addEventListener("keydown", function (e) {
    if (e.key === "F11" && e.ctrlKey && e.altKey && !e.shiftKey) {
        e.preventDefault();
        window.parent.postMessage({ type: "${FORWARD_KEY_MESSAGE}", key: e.key, ctrlKey: true, altKey: true, shiftKey: false }, "*");
    }
}, true);
`

/**
 * Builds the iframe's HTML. The game listens to window.load and initialises
 * itself: initRenderer(), atlas.create(), switchState(homeState), executive.init().
 */
function buildIframeHtml(gameJs: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <style>
        html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
        canvas { display: block; image-rendering: pixelated; }
        #atlas { display: none; }
    </style>
</head>
<body>
    <canvas id='canvas'></canvas>
    <canvas id='atlas'></canvas>
    <script>${FORWARD_KEY_SCRIPT}</script>
    <script>${withBridge(gameJs)}</script>
</body>
</html>`
}

export class PacmanMachine {
    private hostDiv: HTMLDivElement | undefined
    private iframe: HTMLIFrameElement | undefined
    private resizeObserver: ResizeObserver | undefined
    private messageListener: ((e: MessageEvent) => void) | undefined

    /** Called with every change of the game's state. Set by the channel. */
    onState: ((state: IPacmanGameState) => void) | undefined

    /** The game has the keyboard: the focus is inside its iframe. */
    hasFocus(): boolean {
        return this.iframe !== undefined && document.activeElement === this.iframe
    }

    /** Pauses or resumes the game itself, not just the plugin's flag. */
    setPaused(paused: boolean): void {
        this.iframe?.contentWindow?.postMessage({ type: PAUSE_MESSAGE, paused }, '*')
    }

    /** Creates the host and the iframe, and loads the game. */
    init(): void {
        if (this.hostDiv) return

        this.hostDiv = document.createElement('div')
        // z-index 1: above normal flow, below MUI menus/popovers (z-index 1000+).
        this.hostDiv.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:1; display:none; background:#000;'
        document.body.appendChild(this.hostDiv)

        this.iframe = document.createElement('iframe')
        this.iframe.title = 'Pac-Man'
        this.iframe.style.cssText = 'width:100%; height:100%; border:0; display:block;'
        this.iframe.setAttribute('allow', 'autoplay')
        // srcdoc with the game HTML — the game runs inside the iframe.
        this.iframe.srcdoc = buildIframeHtml(pacmanGame)
        this.hostDiv.appendChild(this.iframe)

        // The game's state goes to the channel; the shortcut the iframe swallowed is fired again on window,
        // where the core listens for it.
        this.messageListener = (e: MessageEvent) => {
            if (!this.iframe || e.source !== this.iframe.contentWindow) return
            const data = e.data
            if (data && data.type === STATE_MESSAGE) {
                this.onState?.({ score: Number(data.score) || 0, lives: Number(data.lives) || 0, level: Number(data.level) || 0, over: data.over === true })
            }
            else if (data && data.type === FORWARD_KEY_MESSAGE) {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: data.key, ctrlKey: data.ctrlKey, altKey: data.altKey, shiftKey: data.shiftKey, bubbles: true, cancelable: true }))
            }
        }
        window.addEventListener('message', this.messageListener)
    }

    /** Anchors the iframe to a container of the tab (shows the game). */
    attach(anchor: HTMLElement): void {
        if (!this.hostDiv || !this.iframe) return
        this.positionOver(anchor)
        this.hostDiv.style.display = 'block'

        // Reposition when the anchor changes size.
        this.resizeObserver?.disconnect()
        this.resizeObserver = new ResizeObserver(() => this.positionOver(anchor))
        this.resizeObserver.observe(anchor)
    }

    /** Detaches (hides the game when switching tabs). */
    detach(): void {
        if (!this.hostDiv) return
        this.hostDiv.style.display = 'none'
        this.resizeObserver?.disconnect()
        this.resizeObserver = undefined
    }

    /** Destroys the iframe and cleans up. */
    dispose(): void {
        this.resizeObserver?.disconnect()
        this.resizeObserver = undefined
        if (this.messageListener) {
            window.removeEventListener('message', this.messageListener)
            this.messageListener = undefined
        }
        if (this.iframe) {
            this.iframe.remove()
            this.iframe = undefined
        }
        if (this.hostDiv) {
            this.hostDiv.remove()
            this.hostDiv = undefined
        }
    }

    /** Positions the host div over the anchor element. */
    private positionOver = (anchor: HTMLElement): void => {
        if (!this.hostDiv || !this.iframe) return
        const rect = anchor.getBoundingClientRect()
        this.hostDiv.style.left = `${rect.left}px`
        this.hostDiv.style.top = `${rect.top}px`
        this.hostDiv.style.width = `${rect.width}px`
        this.hostDiv.style.height = `${rect.height}px`

        // Scale the canvas to fit the iframe while keeping aspect ratio (224x288 = 7:9)
        const targetW = rect.width
        const targetH = rect.height
        const aspect = 224 / 288
        let w = targetW
        let h = w / aspect
        if (h > targetH) {
            h = targetH
            w = h * aspect
        }
        this.iframe.style.width = `${w}px`
        this.iframe.style.height = `${h}px`
        this.iframe.style.marginLeft = `${(targetW - w) / 2}px`
        this.iframe.style.marginTop = `${(targetH - h) / 2}px`
    }

    get ready(): boolean { return this.hostDiv !== undefined }
}
