import { useEffect, useRef, useState } from 'react'
import { IChannelObject } from '../../model/ITabObject'
import { Box, Button, Stack, TextField } from '@mui/material'
import { OpsObject } from '../../model/OpsObject'
import { InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, OpsCommandEnum, OpsMessage } from '@jfvilas/kwirth-common'
import { v4 as uuidv4 } from 'uuid'
import { Terminal, ColorMode, TerminalOutput } from '../terminal/Terminal'
import { SelectTerminal } from './SelectTerminal'

interface IProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
    onShellInput: (prompt:string, terminalInput:string) => void
}

const TabContentOps: React.FC<IProps> = (props:IProps) => {
    const [command, setCommand] = useState('')
    const [selectedCommand, setSelectedCommand] = useState(0)
    const lastLineRef = useRef(null)
    const [commands, setCommands] = useState<string[]>([])
    const [refresh, setRefresh] = useState(0)
    const [showSelector, setShowSelector] = useState(false)
    const commandRef = useRef<HTMLInputElement>()
    let opsObject = props.channelObject.data as OpsObject

    useEffect(() => {
        if (!opsObject.shell) commandRef.current?.focus()
    }, [refresh])

    const onKeyDown = (event:any) => {
        let key = event.key
        switch (key) {
            case 'ArrowUp':  // up
                if (selectedCommand<commands.length) {
                    setSelectedCommand(selectedCommand+1)
                    setCommand(commands[selectedCommand])
                }
                break
            case 'ArrowDown':  // down
                if (selectedCommand>0) {
                    setSelectedCommand(selectedCommand-1)
                    setCommand(commands[selectedCommand])
                }
                else {
                    setCommand('')
                }
                break
            case 'Enter':
                if (command!=='') {
                    sendCommand(command)
                    setCommands( [...commands, command] )
                    setCommand('')
                }
                break
            default:
                if (key.startsWith('F') && key.length>1) {
                    event.preventDefault()
                    if (key === 'F11') {
                        setShowSelector(true)
                    }
                    else {
                        key = key.substring(1)
                        let index = +key-1
                        if (index < opsObject.shells.length) {
                            opsObject.shell = opsObject.shells[index]
                            setRefresh(Math.random())
                        }
                    }
                }
                break
        }
    }

    const sendCommand = (data:string) => {
        if (!props.webSocket)  return

        let [ns,p,c] = ['','','']
        let params = data.split(' ')
        let cmd = params[0] as OpsCommandEnum
        let obj = params[1]        
        if (obj && (cmd === OpsCommandEnum.SHELL || cmd === OpsCommandEnum.RESTART || cmd === OpsCommandEnum.GET || cmd === OpsCommandEnum.DESCRIBE || cmd === OpsCommandEnum.EXECUTE)) {
            [ns,p,c] = obj.split('/')
            if (cmd === OpsCommandEnum.EXECUTE) {
                params = data.split(' ').splice(2)
            }
        }
        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            accessKey: opsObject.accessKey,
            instance: props.channelObject.instance,
            id: uuidv4(),
            command: cmd,
            namespace: ns,
            group: '',
            pod: p,
            container: c,
            params: params,
            msgtype: 'opsmessage'
        }
        let payload = JSON.stringify( opsMessage )
        props.webSocket.send(payload)
    }

    const formatConsole = () => {
        if (!props.channelObject.data || !props.channelObject.data) return <></>
         if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })

        return <pre>
            {opsObject.messages.map((message, index) => {
                if (index === opsObject.messages.length-1)
                    return <div key={index}>{message}</div>
                else
                    return <div key={index}>{message}</div>
            })}
            <br ref={lastLineRef}/>
        </pre>
    }

    const onShellInput = (prompt:string, terminalInput:string) => {        
        if (terminalInput ==='clear') {
            props.onShellInput('', 'clear')
            return
        }
        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            accessKey: opsObject.accessKey,
            instance: props.channelObject.instance,
            id: '1', //uuidv4(),
            command: OpsCommandEnum.INPUT,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            params: terminalInput.split(' '),
            msgtype: 'opsmessage'
        }
        let payload = JSON.stringify( opsMessage )
        if (props.webSocket) {
            props.webSocket.send(payload)
            props.onShellInput(prompt, terminalInput)
        }
    }

    const onShellKey = (key:string) => {
        if (key === 'F12') {
            opsObject.shell = undefined
            setRefresh(Math.random())
            // commandRef.current.focus();            
        }
        else if (key === 'F11') {
            setShowSelector(true)
        }
        else if (key.startsWith('F') && key.length>1) {
            key = key.substring(1)
            let index = +key-1
            if (index < opsObject.shells.length) {
                opsObject.shell = opsObject.shells[index]
                setRefresh(Math.random())
            }
        }
    }

    const selectTerminal = (index:number) =>  {
        console.log(index)
        setShowSelector(false)
        if (index>=0) {
            opsObject.shell = opsObject.shells[index]
            setRefresh(Math.random())
        }
    }

    const showTerminal = (namespace:string, pod:string, container: string) => {
        let shellIndex = opsObject.shells.findIndex(c => c.namespace === namespace && c.pod === pod && c.container === container)
        if (shellIndex<0 ) return <></>
        let shell = opsObject.shells[shellIndex]
          return (
            <Terminal name={`${namespace}/${pod}/${container}` + (shellIndex<10? `(Key F${shellIndex+1})`:'') } colorMode={ColorMode.Light} onInput={onShellInput} onKey={onShellKey} inputEnabled={shell.connected}>
                {shell.lines.map(line => <TerminalOutput>{line}</TerminalOutput>)}
            </Terminal>
          )
    }
    const formatSelector = () => {
        let current = -1
        if (opsObject.shell) current = opsObject.shells.indexOf(opsObject.shell)
        return <>
            { showSelector && <SelectTerminal onSelect={selectTerminal} shells={opsObject.shells} current={current}></SelectTerminal>}
        </>
    }

    return <>
        <Stack direction='column' alignItems={'start'} sx={{height:'80%', ml:1, mr:1}}>
            {formatSelector()}
            { opsObject.shell && showTerminal(opsObject.shell.namespace, opsObject.shell.pod, opsObject.shell.container) }
            { !opsObject.shell && <>            
                <Box sx={{ flex:1, width:'100%' }}>
                    {formatConsole()}
                </Box>
                <Stack direction={'row'} sx={{width:'100%'}}>
                    <TextField inputRef={commandRef} value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={onKeyDown} variant='standard' fullWidth disabled={opsObject.accessKey===''}/>
                    <Button onClick={() => onKeyDown( { key:'Enter'})} disabled={opsObject.accessKey===''}>ENTER</Button>
                </Stack>
            </>}
        </Stack>
        <br/>
    </>
}
export { TabContentOps }