import React, { useEffect, useRef } from "react";
import { TerminalManager } from "./TerminalManager";

interface IProps {
    id: string|undefined
    terminalManager:TerminalManager
}

export const TerminalInstance: React.FC<IProps> = (props:IProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect ( () => {
        if (!props.id) return
        const managedTerminal = props.terminalManager.attachTerminal(props.id)
        if (managedTerminal) managedTerminal.fitAddon.fit()
    })

    useEffect(() => {
        if (!props.id) return

        const managedTerminal = props.terminalManager.attachTerminal(props.id)
        if (managedTerminal) {
            const { term, fitAddon } = managedTerminal

            const resizeObserver = new ResizeObserver(() => {
                if (containerRef.current && containerRef.current.offsetWidth > 0) {
                    const { offsetWidth, offsetHeight } = containerRef.current;
                    console.log(`Contenedor: ${offsetWidth}x${offsetHeight}px | Term: ${term.cols}x${term.rows}`);
                    requestAnimationFrame(() => {
                        fitAddon.fit()
                        
                        // IMPORTANTE: Aquí deberías notificar al backend el cambio de filas/columnas
                        // props.terminalManager.notifyResize(props.id, term.cols, term.rows);
                        console.log(`Resize: ${term.cols}x${term.rows}`);
                    });
                }
            });


            // Foco inicial
            setTimeout(() => term.focus(), 100);                

            if (containerRef.current) {
                term.open(containerRef.current)
                resizeObserver.observe(containerRef.current)
                //resizeObserver.observe(document.body)
                fitAddon.fit()
            }
 
            return () => {
                // Detach terminal from DOM, but do NOT dispose it.
                resizeObserver.disconnect()
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
        <div ref={containerRef} style={{ width: '100%', height:'100%', flex:1, minHeight:0, overflow: 'hidden', background: 'black', paddingBottom:'16px' }} />
    )
}