import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent, ReactElement } from 'react';
import './style.css';
  
export enum ColorModeEnum {
    Light,
    Dark,
    Terminal3270
}
  
export interface Props {
    name?: string
    height?: string
    colorMode?: ColorModeEnum
    inputEnabled: boolean
    children: ReactElement[]
    startingInputValue?: string
    onInput: (prompt:string, input: string) => void
    onKey: (key: string) => void
    lines: string[]
}
  
const Terminal = ({name, height = '600px', colorMode, onInput, onKey, children, inputEnabled, startingInputValue = '', lines }: Props) => {
    //+++ adjust height to visible window
    const [currentLineInput, setCurrentLineInput] = useState('')
    const scrollIntoViewRef = useRef<HTMLDivElement>(null)
  
    const updateCurrentLineInput = (event: ChangeEvent<HTMLInputElement>) => {
        setCurrentLineInput(event.target.value)
    }
  
    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12' ].includes(event.key)) {
            event.preventDefault()
            onKey(event.key)
            return
        }
        if (!inputEnabled) {
          event.preventDefault()
          return
        }

        if (event.key === 'Enter') {
            let prompt = ''
            if (children.length>0 &&  children[children.length-1].props && children[children.length-1].props.children) {
                prompt = children[children.length-1].props.children
            }
            lines.pop()
            onInput(prompt, currentLineInput)
            setCurrentLineInput('')
            setTimeout(() => scrollIntoViewRef?.current?.scrollIntoView({ behavior: "auto", block: "nearest" }), 500);
        }
        else if ((event.key === 'c') && event.ctrlKey) {
            event.preventDefault()
            onInput('',currentLineInput+'^C')
            setCurrentLineInput('')
        }
        else if ((event.key === 'd') && event.ctrlKey) {
            event.preventDefault()
            if (currentLineInput==='') {
                setCurrentLineInput('')
                onInput('', 'exit')
            }
        }
    }
  
    useEffect(() => {
        setCurrentLineInput(startingInputValue.trim());
    }, [startingInputValue]);
  
    // We use a hidden input to capture terminal input; make sure the hidden input is focused when clicking anywhere on the terminal
    useEffect(() => {
        const elListeners: { terminalEl: Element; listener: EventListenerOrEventListenerObject }[] = []

        for (let terminalEl of Array.from(document.getElementsByClassName('react-terminal-wrapper'))) {
            const listener = () => (terminalEl?.querySelector('.terminal-hidden-input') as HTMLElement)?.focus()
            terminalEl?.addEventListener('click', listener)
            elListeners.push({ terminalEl, listener })
        }
        return function cleanup () {
            elListeners.forEach(elListener => {
            elListener.terminalEl.removeEventListener('click', elListener.listener)
            })
        }
    }, [onInput])
  
    const classes = ['react-terminal-wrapper']
    if (colorMode === ColorModeEnum.Light) {
        classes.push('react-terminal-light')
    }
    else if (colorMode === ColorModeEnum.Terminal3270) {
        classes.push('react-terminal-3270')
    }

    const content = (): JSX.Element => {
        let prompt = ''
        if (children.length>0 && children[children.length-1].props && children[children.length-1].props.children) {
            prompt = children[children.length-1].props.children.trim()
            let lines = prompt.split('\n')
            prompt = lines[lines.length-1].trim()
            let len = children.length
            if (prompt === children[children.length-1].props.children) len--
            return <>
                {children.slice(0, len)}
                <div style={{marginTop:-1}} className="react-terminal-line react-terminal-input react-terminal-active-input" data-terminal-prompt={ prompt }>{ currentLineInput }<span className="cursor"></span></div>
            </>
        }
        else {
            return <div className="react-terminal-line react-terminal-input react-terminal-active-input" data-terminal-prompt={ prompt }>{currentLineInput}<span className="cursor"></span></div>
        }
    }

    return (
        <div className={ classes.join(' ') } data-terminal-name={name}>
            <div className={`react-terminal`} style={{height}}>
                {content()}
                <div ref={scrollIntoViewRef}></div>
            </div>
            <input className="terminal-hidden-input" placeholder="Terminal Hidden Input" value={currentLineInput} autoFocus={true} onChange={updateCurrentLineInput} onKeyDown={handleInputKeyDown}/>
        </div>
    )
}
  
export { Terminal }