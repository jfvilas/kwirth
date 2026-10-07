import { ComponentType } from 'react'
import { PROVIDER_ID } from '../common/FlightStatus'
import FlightStatusConfigDialog from './FlightStatusConfigDialog'

interface IProviderFront {
    ConfigDialog: ComponentType<React.ComponentProps<typeof FlightStatusConfigDialog>>
}

declare global { interface Window { __kwirth_providers__: Record<string, IProviderFront> } }

window.__kwirth_providers__ = window.__kwirth_providers__ ?? {}
window.__kwirth_providers__[PROVIDER_ID] = { ConfigDialog: FlightStatusConfigDialog }
