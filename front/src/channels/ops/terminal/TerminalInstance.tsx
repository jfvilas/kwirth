import React, { useEffect, useRef } from "react";
import { TerminalManager } from "./TerminalManager";

interface IProps {
    id: string|undefined
    terminalManager:TerminalManager
}

export const TerminalInstance: React.FC<IProps> = (props:IProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!props.id) return

        const attachedTerminal = props.terminalManager.attachTerminal(props.id)
        if (attachedTerminal) {
            const { term, fitAddon } = attachedTerminal

            if (containerRef.current) {
                term.open(containerRef.current)
                fitAddon.fit()
            }
 
            return () => {
                // Detach terminal from DOM, but do NOT dispose it.
                if (containerRef.current) containerRef.current.innerHTML = ""
            }
        }
    }, [props.id])

    if (!props.id) return <></>

    if (props.terminalManager && props.id) {
        let t = props.terminalManager.terminals.get(props.id)
        if (t) setTimeout ( () => t!.term.focus(), 100)
    }

    return (
        <div ref={containerRef} style={{ width: "100%", height: "92%", overflow: 'hidden', background: 'black', paddingBottom:'16px' }} />
    )
}