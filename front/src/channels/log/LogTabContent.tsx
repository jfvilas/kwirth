import { ILogMessage, InstanceConfigViewEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { ILogLine, LogObject } from './LogObject'
import { Box } from '@mui/material'
import { IContentProps } from '../IChannel'
import { useEffect, useRef, useState } from 'react'

const LogTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let logObject = props.channelObject.uiData as LogObject

    const logBoxRef = useRef<HTMLDivElement | null>(null)
    const [logBoxTop, setLogBoxTop] = useState(0)
    const lastLineRef = useRef<HTMLSpanElement|null>(null)

    useEffect(() => {
        if (logBoxRef.current) setLogBoxTop(logBoxRef.current.getBoundingClientRect().top)
    },[])

    if (!props.channelObject.uiData || !props.channelObject.uiData) return <pre></pre>

    const formatLogLine = (imessage:ILogLine) => {
        if (!imessage) return null

        let logMessage = imessage as ILogMessage
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

    if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })

    return <Box ref={logBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(85vh - ${logBoxTop}px)`}}>
        <pre>
            {logObject.messages.map((message, index) => { return <div key={index}>{formatLogLine(message)}</div> })}
        </pre>
        <br/>
        <span ref={lastLineRef}/>
    </Box>

}
export { LogTabContent }