import { InstanceConfigViewEnum, InstanceMessageTypeEnum, LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { IChannelObject } from '../../../model/ITabObject'
import { ILogLine, LogObject } from '../../../model/LogObject'
// import { Button, TextField } from '@mui/material'
// import { useState } from 'react'

interface IProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
    lastLineRef: React.MutableRefObject<null>
}

const TabContentLog: React.FC<IProps> = (props:IProps) => {
    // const [input, setInput] = useState('')
    let logObject = props.channelObject.data as LogObject

    if (!props.channelObject.data || !props.channelObject.data) return <pre></pre>

    const formatLogLine = (imessage:ILogLine|null) => {
        if (!imessage) return null

        let logMessage = imessage as LogMessage
        if (logMessage.type === InstanceMessageTypeEnum.DATA) {
            var txt = logMessage.text
            if (props.channelObject.view === InstanceConfigViewEnum.NAMESPACE) {
                let preLength = logMessage.pod!.length+1
                txt=txt.replaceAll('\n','\n' + ' '.repeat(preLength) ).trimEnd()
            }

            let prefix = ''
            if (props.channelObject.view === InstanceConfigViewEnum.POD) prefix = logMessage.container || ''
            if (props.channelObject.view === InstanceConfigViewEnum.GROUP) prefix = logMessage.pod + '/'+logMessage.container || ''
            if (props.channelObject.view === InstanceConfigViewEnum.NAMESPACE) {
                return <><span style={{color:'blue'}}>{logMessage.pod + '/' + logMessage.container + ' '}</span>{txt}</>
            }
            else
                return <><span style={{color:'blue'}}>{prefix+' '}</span>{txt}</>
        }
        else if (imessage.type === InstanceMessageTypeEnum.SIGNAL) {
            let signal = imessage as SignalMessage
            switch (signal.level) {
                case SignalMessageLevelEnum.INFO:
                    return <span style={{color:'blue'}}><b>{`***** ${signal.text} *****`}</b></span>
                case SignalMessageLevelEnum.WARNING:
                    return <span style={{color:'orange'}}><b>{`***** ${signal.text} *****`}</b></span>
                case SignalMessageLevelEnum.ERROR:
                    return <span style={{color:'red'}}><b>{`***** ${signal.text} *****`}</b></span>
            }
        }
        else  {
            return <span>{logMessage.text}</span>
        }
    }

    if (logObject.follow && props.lastLineRef.current) {
        (props.lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })
    }

    // const routeCommand = () => {
    //     let om:OpsMessage = {
    //         msgtype: 'opsmessage',
    //         action: InstanceMessageActionEnum.COMMAND,
    //         flow: InstanceMessageFlowEnum.IMMEDIATE,
    //         type: InstanceMessageTypeEnum.DATA,
    //         channel: InstanceMessageChannelEnum.OPS,
    //         instance: '',
    //         id: '1',
    //         accessKey: logObject.accessKey,
    //         command: OpsCommandEnum.RESTARTPOD,
    //         namespace: props.channelObject.namespace,
    //         group: props.channelObject.group,
    //         pod: props.channelObject.pod,
    //         container: props.channelObject.container
    //     }
    //     let rm: RouteMessage = {
    //         msgtype: 'routemessage',
    //         accessKey: logObject.accessKey,
    //         destChannel: InstanceMessageChannelEnum.OPS,
    //         action: InstanceMessageActionEnum.ROUTE,
    //         flow: InstanceMessageFlowEnum.IMMEDIATE,
    //         type: InstanceMessageTypeEnum.SIGNAL,
    //         channel: InstanceMessageChannelEnum.LOG,
    //         instance: props.channelObject.instance,
    //         data: om
    //     }
    //     props.webSocket?.send(JSON.stringify(rm))
    // }

    return <>
        <pre> {
            logObject.messages.map((message, index) => { return <div key={index}>{formatLogLine(message)}</div> })
        }
        </pre>
        {/* <TextField value={input} onChange={(e) => setInput(e.target.value)}></TextField>
        <Button onClick={send}>SEND</Button> */}
        <br/>
        <span ref={props.lastLineRef}></span>
    </>
}
export { TabContentLog }