import { InstanceMessage, InstanceMessageTypeEnum, LogMessage, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { IChannelObject } from '../../model/ITabObject'
import { LogObject } from '../../model/LogObject'

interface IProps {
    channelObject: IChannelObject
    lastLineRef: React.MutableRefObject<null>
}

const TabContentLog: React.FC<IProps> = (props:IProps) => {

    const formatLogLine = (imessage:InstanceMessage|null) => {
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
        if (!props.channelObject.data || !props.channelObject.data) return <pre key={456456}></pre>
        let logObject = props.channelObject.data as LogObject
        return <pre key={2342344}>
            {logObject.messages.map((message, index) => {
                if (index === logObject.messages.length-1)
                    return <div key={index} ref={props.lastLineRef} style={{marginBottom:'24px'}}>{formatLogLine(message)}</div>
                else 
                    return <div key={index}>{formatLogLine(message)}</div>
            })}
        </pre>
    }

    return formatLog()
}
export { TabContentLog }