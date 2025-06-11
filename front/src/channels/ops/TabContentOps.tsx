import { useEffect, useRef, useState } from 'react'
import { Box, Button, Stack, TextField } from '@mui/material'
import { OpsObject } from './OpsObject'
import { InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, OpsCommandEnum, OpsMessage } from '@jfvilas/kwirth-common'
import { v4 as uuidv4 } from 'uuid'
import { Terminal, ColorMode } from './terminal/Terminal'
import { SelectTerminal } from './terminal/SelectTerminal'
import { IChannelObject } from '../IChannel'

interface IProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const TabContentOps: React.FC<IProps> = (props:IProps) => {
    const [command, setCommand] = useState('')
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
    const lastLineRef = useRef(null)
    const [commands, setCommands] = useState<string[]>([])
    const [refresh, setRefresh] = useState(0)
    const [showSelector, setShowSelector] = useState(false)
    const commandRef = useRef<HTMLInputElement>()
    let opsObject = props.channelObject.uiData as OpsObject

    useEffect(() => {
        if (!opsObject.shell) commandRef.current?.focus()
    }, [refresh])

    useEffect(() => {
        if (!showSelector) window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    })

    const onKeyDown = (event:any) => {
        let key = event.key
        switch (key) {
            case 'ArrowUp':  // up
                if (selectedCommandIndex<commands.length-1) {
                    setSelectedCommandIndex((p) => p+1)
                    setCommand(commands[selectedCommandIndex+1])
                }
                event.preventDefault()
                event.stopPropagation()
                break
            case 'ArrowDown':  // down
                if (selectedCommandIndex>0) {
                    setSelectedCommandIndex(selectedCommandIndex-1)
                    setCommand(commands[selectedCommandIndex-1])
                }
                else {
                    setCommand('')
                }
                event.preventDefault()
                event.stopPropagation()
                break
            case 'Enter':
                if (command!=='') {
                    sendCommand(command)
                    setCommands((prev) =>  [command, ...prev] )
                    setCommand('')
                    setSelectedCommandIndex(0)
                }
                if (event.preventDefault) {
                    event.preventDefault()
                    event.stopPropagation()
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
                    event.preventDefault()
                    event.stopPropagation()    
                }
                break
        }
    }

    const sendCommand = (data:string) => {
        if (!props.webSocket)  return

        let [namespace,pod,container] = ['','','']
        let params = data.trim().split(' ').map(p => p.trim()).filter(p => p!=='')
        let cmd = params[0] as OpsCommandEnum
        let obj = params[1]
        if (obj && (cmd === OpsCommandEnum.SHELL || cmd === OpsCommandEnum.RESTART || cmd === OpsCommandEnum.RESTARTPOD || cmd === OpsCommandEnum.RESTARTNS || cmd === OpsCommandEnum.GET || cmd === OpsCommandEnum.DESCRIBE || cmd === OpsCommandEnum.EXECUTE)) {
            [namespace,pod,container] = obj.split('/')
            if (cmd === OpsCommandEnum.EXECUTE) {
                params = params.slice(2)
            }
        }
        if (cmd === OpsCommandEnum.SHELL) {
            let index = opsObject.shells.findIndex ( s => s.namespace===namespace && s.pod===pod && s.container===container)
            if (index>=0) {
                opsObject.shell = opsObject.shells[index]
                setRefresh(Math.random())
                return
            }
        }
        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            accessKey: opsObject.accessKeyString,
            instance: props.channelObject.instanceId,
            id: uuidv4(),
            command: cmd,
            namespace: namespace,
            group: '',
            pod: pod,
            container: container,
            params: params,
            msgtype: 'opsmessage'
        }
        let payload = JSON.stringify( opsMessage )
        props.webSocket.send(payload)
    }

    const formatConsole = () => {
        if (!props.channelObject.uiData || !props.channelObject.uiData) return <></>
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

    // const startImmed = (shellInput:string) => {
    //     if (props.webSocket) {
    //         let ws = new WebSocket(props.webSocket?.url)
    //         ws.onopen = (ev) => sendImmed(ev, shellInput)
    //         ws.onmessage = (ev) => recvImmed(ev)
    //         ws.onerror = (ev) => console.log('err')
    //         ws.onclose = (ev) => console.log('close')
    //     }
    // }

    // const recvImmed = (event:any) => {
    //     console.log(event)
    // }

    // const sendImmed = (event:any, shellInput:string) => {
    //     let obj = shellInput.split(' ')[1]
    //     let [ns,p,c] = obj.split('/')

    //     let opsMessage:OpsMessage = {
    //         flow: InstanceMessageFlowEnum.IMMEDIATE,
    //         action: InstanceMessageActionEnum.COMMAND,
    //         channel: InstanceMessageChannelEnum.OPS,
    //         type: InstanceMessageTypeEnum.DATA,
    //         command: OpsCommandEnum.EXECUTE,
    //         accessKey: opsObject.accessKey,
    //         instance: '',
    //         id: '1',
    //         namespace: ns,
    //         group: '',
    //         pod: p,
    //         container: c,
    //         params: ['ls','/'],
    //         msgtype: 'opsmessage'
    //     }
    //     let payload = JSON.stringify( opsMessage )
    //     if (props.webSocket) event.target.send(payload)
    // }

    const onShellInput = (prompt:string, shellInput:string) => {        
        if (shellInput ==='clear') {
            if (opsObject.shell) {
                opsObject.shell.lines=[]
                setRefresh(Math.random())
            }
            return
        }

        // if (shellInput.toLowerCase().startsWith('immed')) {
        //     startImmed(shellInput)
        //     return
        // }

        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            command: OpsCommandEnum.INPUT,
            accessKey: opsObject.accessKeyString,
            instance: props.channelObject.instanceId,
            id: opsObject.shell? opsObject.shell.id : '',
            namespace: opsObject.shell? opsObject.shell.namespace : '',
            group: '',
            pod: opsObject.shell? opsObject.shell.pod : '',
            container: opsObject.shell? opsObject.shell.container : '',
            params: shellInput.split(' '),
            msgtype: 'opsmessage'
        }
        let payload = JSON.stringify( opsMessage )
        if (props.webSocket) props.webSocket.send(payload)
    }

    const onShellKey = (key:string) => {
        if (key === 'F12') {
            opsObject.shell = undefined
            setRefresh(Math.random())
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
        else if (key ==='^c') {
            if (opsObject.shell) {
                opsObject.shell.lines.push('^c')
                setRefresh(Math.random())
            }
        }
    }

    const selectTerminal = (index:number) =>  {
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
            <Terminal name={`${namespace}/${pod}/${container}` + (shellIndex<10? ` (Key F${shellIndex+1})`:'') } colorMode={ColorMode.Light} onInput={onShellInput} onKey={onShellKey} inputEnabled={shell.connected}>
                {shell.lines.map( (line,index) => <div key={index} className="react-terminal-line">{line}</div>)}
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
            { formatSelector() }
            { opsObject.shell && showTerminal(opsObject.shell.namespace, opsObject.shell.pod, opsObject.shell.container) }
            { !opsObject.shell && <>            
                <Box sx={{ flex:1, overflowY: 'auto', width:'100%' }}>
                    {formatConsole()}
                </Box>
                <Stack direction={'row'} sx={{width:'100%'}}>
                    <TextField inputRef={commandRef} value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={onKeyDown} autoComplete='off' variant='standard' fullWidth disabled={opsObject.accessKeyString===''}/>
                    <Button onClick={() => onKeyDown( { key:'Enter'})} disabled={opsObject.accessKeyString===''}>ENTER</Button>
                </Stack>
            </>}
        </Stack>
        <br/>
    </>
}
export { TabContentOps }