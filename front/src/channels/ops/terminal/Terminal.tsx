import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent, ReactElement } from 'react';
import './style.css';
  
export enum ColorMode {
    Light,
    Dark
}
  
export interface Props {
    name?: string
    height?: string
    colorMode?: ColorMode
    inputEnabled: boolean
    children: ReactElement[]
    startingInputValue?: string
    onInput: (prompt:string, input: string) => void
    onKey: (key: string) => void
    lines: string[]
}
  
const Terminal = ({name, height = "600px", colorMode, onInput, onKey, children, inputEnabled, startingInputValue = "", lines }: Props) => {
    const [currentLineInput, setCurrentLineInput] = useState('')
    const scrollIntoViewRef = useRef<HTMLDivElement>(null)
  
    const updateCurrentLineInput = (event: ChangeEvent<HTMLInputElement>) => {
        setCurrentLineInput(event.target.value)
    }
  
    // Calculates the total width in pixels of the characters to the right of the cursor.
    // Create a temporary span element to measure the width of the characters.
    const calculateInputWidth = (inputElement: HTMLInputElement, chars: string) => {
        const span = document.createElement('span')
        span.style.visibility = 'hidden'
        span.style.position = 'absolute'
        span.style.fontSize = window.getComputedStyle(inputElement).fontSize
        span.style.fontFamily = window.getComputedStyle(inputElement).fontFamily
        span.innerText = chars
        document.body.appendChild(span)
        const width = span.getBoundingClientRect().width
        document.body.removeChild(span)
        // Return the negative width, since the cursor position is to the left of the input suffix
        return -width
    }
  
    const clamp = (value: number, min: number, max: number) => {
        if(value > max) return max
        if(value < min) return min
        return value
    }
  
    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12' ].includes(event.key)) {
            event.preventDefault()
            onKey(event.key)
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
        else if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Delete'].includes(event.key)) { 
            const inputElement = event.currentTarget;
            let charsToRightOfCursor = "";
            let cursorIndex = currentLineInput.length - (inputElement.selectionStart || 0);
            cursorIndex = clamp(cursorIndex, 0, currentLineInput.length);
    
            if(event.key === 'ArrowLeft') {
                if(cursorIndex > currentLineInput.length - 1) cursorIndex --
                charsToRightOfCursor = currentLineInput.slice(currentLineInput.length -1 - cursorIndex)
            }
            else if (event.key === 'ArrowRight' || event.key === 'Delete') {
                charsToRightOfCursor = currentLineInput.slice(currentLineInput.length - cursorIndex + 1)
            }
            else if (event.key === 'ArrowUp') {
                charsToRightOfCursor = currentLineInput.slice(0)
            }
        }
        else if ((event.key === 'c') && event.ctrlKey) {
            event.preventDefault()
            setCurrentLineInput('')
            onKey('^c')
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
    if (colorMode === ColorMode.Light) {
        classes.push('react-terminal-light')
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
            <div className="react-terminal" style={{height}}>
                {content()}
                <div ref={scrollIntoViewRef}></div>
            </div>
            <input className="terminal-hidden-input" placeholder="Terminal Hidden Input" value={currentLineInput} autoFocus={true} onChange={updateCurrentLineInput} onKeyDown={handleInputKeyDown}/>
        </div>
    )
}
  
export { Terminal }