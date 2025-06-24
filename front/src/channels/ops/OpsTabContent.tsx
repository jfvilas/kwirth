import { useEffect, useRef, useState } from 'react'
import { Box, Button, Stack, TextField } from '@mui/material'
import { IOpsObject, OpsCommandEnum, OpsMessage } from './OpsObject'
import { InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { v4 as uuidv4 } from 'uuid'
import { Terminal } from './terminal/Terminal'
import { SelectTerminal } from './terminal/SelectTerminal'
import { IContentProps } from '../IChannel'
import { OPSHELPMESSAGE } from '../../tools/Constants'
import { IOpsUiConfig } from './OpsConfig'

const OpsTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let opsObject:IOpsObject = props.channelObject.uiData
    let opsUiConfig:IOpsUiConfig = props.channelObject.uiConfig

    const [command, setCommand] = useState('')
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
    const lastLineRef = useRef(null)
    const [commands, setCommands] = useState<string[]>([])
    const [refresh, setRefresh] = useState(0)
    const [showSelector, setShowSelector] = useState(false)
    const commandRef = useRef<HTMLInputElement>()

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
                    switch (command.toLowerCase()) {
                        case 'clear':
                            opsObject.messages = []
                            setCommand('')
                            break
                        case 'help':
                            opsObject.messages.push(...OPSHELPMESSAGE)
                            setCommand('')
                            break
                        default:
                            sendCommand(command)
                            setCommands((prev) =>  [command, ...prev] )
                            setCommand('')
                            setSelectedCommandIndex(0)
                            break
                    }
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
        let cmd = params[0].toLowerCase() as OpsCommandEnum
        let obj = params[1]
        if (obj && (cmd === OpsCommandEnum.SHELL || cmd === OpsCommandEnum.RESTART || cmd === OpsCommandEnum.RESTARTPOD || cmd === OpsCommandEnum.RESTARTNS || cmd === OpsCommandEnum.GET || cmd === OpsCommandEnum.DESCRIBE || cmd === OpsCommandEnum.EXECUTE)) {
            [namespace,pod,container] = obj.split('/')
            if (cmd === OpsCommandEnum.EXECUTE) params = params.slice(2)
        }
        if (cmd === OpsCommandEnum.SHELL) {
            let index = opsObject.shells.findIndex ( s => s.namespace===namespace && s.pod===pod && s.container===container)
            if (index>=0) {
                opsObject.shell = opsObject.shells[index]
                if (opsObject.shell.connected) {
                    setRefresh(Math.random())
                    return
                }
                else {

                }
            }
        }
        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            accessKey: props.channelObject.accessString!,
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

    const onInputTerminal = (prompt:string, shellInput:string) => {        
        if (shellInput ==='clear') {
            if (opsObject.shell) {
                opsObject.shell.lines = [ prompt ]
                setRefresh(Math.random())
            }
            return
        }
        if (shellInput.endsWith('^C')) {
            if (opsObject.shell) {
                opsObject.shell.lines[opsObject.shell.lines.length-1] += prompt + shellInput
                opsObject.shell.lines.push(prompt)
                setRefresh(Math.random())
            }
            return
        }

        if (opsObject.shell) opsObject.shell.pending = prompt
        
        let opsMessage:OpsMessage = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.COMMAND,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            command: OpsCommandEnum.INPUT,
            accessKey: props.channelObject.accessString!,
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

    const onKeyTerminal = (key:string) => {
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
        <Terminal name={`${namespace}/${pod}/${container}` + (shellIndex<10? ` (Key F${shellIndex+1})`:'') } colorMode={opsUiConfig.colorMode} onInput={onInputTerminal} onKey={onKeyTerminal} inputEnabled={shell.connected} lines={shell.lines}>
            {shell.lines.map( (line,index) => <div key={index} className='react-terminal-line'>{line}</div>)}
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
                    <TextField inputRef={commandRef} value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={onKeyDown} autoComplete='off' variant='standard' fullWidth disabled={!props.channelObject.accessString}/>
                    <Button onClick={() => onKeyDown( { key:'Enter'})} disabled={!props.channelObject.accessString}>ENTER</Button>
                </Stack>
            </>}
        </Stack>
        <br/>
    </>
}

export { OpsTabContent }