import { useEffect } from 'react'

type CloseWithId = (id: string) => void
type CloseNoId = () => void

export const useEscape = (onClose: CloseWithId | CloseNoId, id?: string) => {
    useEffect(() => {
        //const previousFocus = document.activeElement as HTMLElement

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                if (id) 
                    (onClose as CloseWithId)(id)
                else
                    (onClose as CloseNoId)()
            }
        }
        window.addEventListener('keydown', handleKeyDown, true)

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            //previousFocus?.focus()
        }
    }, [onClose, id])
}