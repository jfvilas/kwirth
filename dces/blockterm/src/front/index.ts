import { DCE_FRONT_FACTORIES } from '@kwirthmagnify/kwirth-common'
import { createBlockterm } from './BlockTerm'

/*
    The front end of DCE `blockterm`.

    A front script cannot be handed a host as a parameter, so the handshake is a registration: the
    script leaves its factory at `window.__kwirth_dce_factories__['blockterm']`, and the core's loader
    calls create() once and writes the result into `window.__kwirth_dce__['blockterm']`, where a consumer
    reads it through the DCE_PACKAGES mapping of its build (or getDce() from common-front).
*/
type TFactories = Record<string, { create: () => unknown }>

const w = window as unknown as Record<string, TFactories | undefined>
const factories = (w[DCE_FRONT_FACTORIES] ??= {})
factories['blockterm'] = { create: () => createBlockterm('blockterm') }
