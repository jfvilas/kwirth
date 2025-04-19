import { useState } from 'react'
import { InstanceMessage, InstanceMessageTypeEnum, LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { IChannelObject } from '../../model/ITabObject'
import { LogObject } from '../../model/LogObject'
import { Button, TextField } from '@mui/material'

interface IProps {
    channelObject: IChannelObject
}

const TabContentOps: React.FC<IProps> = (props:IProps) => {
    const [command, setCommand] = useState('')

    const formatLogLine = (imessage:InstanceMessage|null, index:number) => {
        if (!imessage) return null

        let logMessage = imessage as LogMessage
        if (logMessage.type === InstanceMessageTypeEnum.DATA) {
            var txt = logMessage.text
            if (props.channelObject.view==='namespace') {
                var preLength = logMessage.pod!.length+1
                var preBlanks = ' '.repeat(preLength)
                txt=txt.replaceAll('\n','\n'+preBlanks).trimEnd()
            }

            var prefix = ''
            if (props.channelObject.view==='pod') prefix = logMessage.container || ''
            if (props.channelObject.view==='container' && props.channelObject.container.includes(',')) prefix = logMessage.container || ''
            if (props.channelObject.view==='namespace') {
                return <><span style={{color:'blue'}}>{logMessage.pod+' '}</span>{txt}</>
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

    const formatLog = () => {
        if (!props.channelObject.data || !props.channelObject.data) return <></>
        let logObject = props.channelObject.data as LogObject
        return <pre>
            {logObject.messages.map((message, index) => {
                return <div key={index}>{formatLogLine(message, index)}</div>
            })}
        </pre>
    }

    return <>
        <TextField value={command} onChange={(e) => setCommand(e.target.value)} /><Button>ENTER</Button>
    </>
}
export { TabContentOps }