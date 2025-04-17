import { InstanceMessageTypeEnum, LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'

interface IProps {
    channelObject:any
    lastLineRef: React.MutableRefObject<null>
}

const TabContentLog: React.FC<any> = (props:IProps) => {

    const formatLogLine = (message:LogMessage|null, index:number) => {
        if (!message) return null

        if (message.type === InstanceMessageTypeEnum.DATA) {
            var txt=message.text
            if (props.channelObject.view==='namespace') {
                var preLength = message.pod!.length+1
                var preBlanks = ' '.repeat(preLength)
                txt=txt.replaceAll('\n','\n'+preBlanks).trimEnd()
            }

            var prefix = ''
            if (props.channelObject.view==='pod') prefix = message.container || ''
            if (props.channelObject.view==='container' && props.channelObject.container.includes(',')) prefix = message.container || ''
            if (props.channelObject.view==='namespace') {
                return <><span style={{color:'blue'}}>{message.pod+' '}</span>{txt}</>
            }
            else
                return <><span style={{color:'blue'}}>{prefix+' '}</span>{txt}</>
        }
        else if (message.type === InstanceMessageTypeEnum.SIGNAL) {
            if ((message as any).action) {
                return <span style={{color:'black'}}><b>{`***** ${message.text} *****`}</b></span>
            }
            else {
                var signal=message as SignalMessage
                switch (signal.level) {
                    case SignalMessageLevelEnum.INFO:
                        return <span style={{color:'blue'}}><b>{`***** ${signal.text} *****`}</b></span>
                    case SignalMessageLevelEnum.WARNING:
                        return <span style={{color:'orange'}}><b>{`***** ${signal.text} *****`}</b></span>
                    case SignalMessageLevelEnum.ERROR:
                        return <span style={{color:'red'}}><b>{`***** ${signal.text} *****`}</b></span>
                }
            }
        }
        else  {
            return <span>{message.text}</span>
        }
    }

    const formatLog = () => {
        let messages = props.channelObject.data.messages as LogMessage[]
        return <pre>
            {messages.map((message, index) => {
                if (index === messages.length-1)
                    return <><div key={index} ref={props.lastLineRef} >{formatLogLine(message, index)}</div><div key={-1} >&nbsp;</div></>
                else 
                    return <div key={index}>{formatLogLine(message, index)}</div>
            })}
        </pre>
    }

    return formatLog()
}
export { TabContentLog }