import { V16MapChannel } from './V16MapChannel'

declare global {
    interface Window { __kwirth_plugins__: Record<string, unknown> }
}

if (!window.__kwirth_plugins__) window.__kwirth_plugins__ = {}
window.__kwirth_plugins__['v16map'] = V16MapChannel
