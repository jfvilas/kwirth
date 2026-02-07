import { ILogLine, ILogData } from './LogData'
import { Box, Card, CardContent, CardHeader, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import { IContentProps } from '../IChannel'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Error, Warning } from '@mui/icons-material'

const LogTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let logData:ILogData = props.channelObject.data
    const logBoxRef = useRef<HTMLDivElement | null>(null)
    const [logBoxHeight, setLogBoxHeight] = useState(0)
    const [filter, setFilter] = useState<string>('')
    const [filterCasing, setFilterCasing] = useState(false)
    const [filterRegex, setFilterRegex] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)

    const adornmentSelected= { margin: 0, borderWidth:1, borderStyle:'solid', borderColor:'gray', paddingLeft:3, paddingRight:3, backgroundColor:'gray', cursor: 'pointer', color:'white'}
    const adornmentNotSelected = { margin: 0, borderWidth:1, borderStyle: 'solid', borderColor:'#f0f0f0', backgroundColor:'#f0f0f0', paddingLeft:3, paddingRight:3, cursor:'pointer'}

    useLayoutEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!logBoxRef.current) return
            const { top } = logBoxRef.current.getBoundingClientRect()
            let a = window.innerHeight - top
            setLogBoxHeight(a)
        })
        observer.observe(document.body)

        return () => observer.disconnect()
    }, [logBoxRef.current])

    useEffect(() => {
        if (isAtBottom && logBoxRef.current) {
            logBoxRef.current.scrollTo({
                top: logBoxRef.current.scrollHeight,
                behavior: 'auto', // 'smooth'
            })
        }
    }, [isAtBottom, logData.messages.length])

    if (!logData) return <pre></pre>

    const formatLogLine = (logLine:ILogLine) => {
        if (!logLine.pod) {
            return <>{logLine.text+'\n'}</>
        }

        if (filter!=='') {
            if (filterCasing) {
                if (filterRegex) {
                    try {
                        const regex=new RegExp(filter)
                        if (!regex.test(logLine.text) && !regex.test(logLine.pod) && !regex.test(logLine.container)) return <></>
                    }
                    catch { return <></> }
                }
                else {
                    if (!logLine.text.includes(filter) && !logLine.pod.includes(filter) && !logLine.container.includes(filter)) return <></>
                }
            }
            else {
                if (filterRegex) {
                    try {
                        const regex=new RegExp(filter.toLocaleLowerCase())
                        if (!regex.test(logLine.text.toLocaleLowerCase()) && !regex.test(logLine.pod.toLocaleLowerCase()) && !regex.test(logLine.container.toLocaleLowerCase())) return <></>
                    }
                    catch { return <></> }
                }
                else {
                    if (!logLine.text.toLocaleLowerCase().includes(filter.toLowerCase()) && !logLine.pod.toLocaleLowerCase().includes(filter.toLocaleLowerCase()) && !logLine.container.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) return <></>
                }
            }
        }

        let podPrefix = <></>
        // if (selectedPodNames.length !== 1 || kwirthLogOptionsRef.current.showNames) {  // +++ log channel doesnt show pod nor container
        //     podPrefix  = <span style={{color:"green"}}>{logLine.pod+' '}</span>
        // }

        let containerPrefix = <></>
        // if (selectedContainerNames.length !== 1){
        //     containerPrefix = <span style={{color:"blue"}}>{logLine.container+' '}</span>
        // }
        return <>{podPrefix}{containerPrefix}{logLine.text+'\n'}</>
    }

    const onChangeFilter = (event: any) => {
        setFilter(event.target?.value)
    }

    const handleScroll = () => {
        if (logBoxRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logBoxRef.current
            const distanceToBottom = scrollHeight - scrollTop - clientHeight
            const atBottom = distanceToBottom < 25
            setIsAtBottom(atBottom)
        }
    }

    return (<>
        <Box sx={{ display:'flex', flexDirection:'column', flexGrow:1, height: `${logBoxHeight}px`, ml:1, mr:1}}>
        {
        <Card sx={{display: 'flex', flexDirection: 'column', flex: 1, width: '98%', alignSelf: 'center', marginTop: '8px',minHeight: 0}}>
            <CardHeader sx={{border:0, borderBottom:1, borderStyle:'solid', borderColor: 'divider', backgroundColor:'#e0e0e0'}} title={
                <Stack direction={'row'} alignItems={'center'}>
                    <Typography marginRight={'32px'}><b>Lines:</b> {logData.messages.length}</Typography>
                    <Typography marginRight={'32px'}><Warning fontSize='small' sx={{marginBottom:'2px', color:'orange'}} /><b>&nbsp;Warning:</b> {logData.messages.filter(m => m.text.includes('WARNING')).length}</Typography>
                    <Typography marginRight={'32px'}><Error fontSize='small' sx={{marginBottom:'2px', color:'red'}}/><b>&nbsp;Error:</b> {logData.messages.filter(m => m.text.includes('ERROR')).length}</Typography>
                    <Typography sx={{flexGrow:1}}></Typography>
                    <TextField value={filter} onChange={onChangeFilter} disabled={!logData.started} size='small' variant='standard' placeholder='Filter...'
                        InputProps={{ endAdornment: 
                            <>
                                <InputAdornment position="start" onClick={() => logData.started && setFilterRegex(!filterRegex)} style={{margin: 0}}>
                                    <Typography style={filterRegex? adornmentSelected : adornmentNotSelected}>.*</Typography>
                                </InputAdornment>
                                <InputAdornment position="start" onClick={() => logData.started && setFilterCasing(!filterCasing)} style={{margin: 0, marginLeft:1}}>
                                    <Typography style={filterCasing? adornmentSelected : adornmentNotSelected}>Aa</Typography>
                                </InputAdornment>
                            </>
                        }}
                    />
                </Stack>}>
            </CardHeader>
            <CardContent
                sx={{backgroundColor: '#f0f0f0', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 0, "&:last-child": { pb: 0 } }}                
            >
                <Box ref={logBoxRef}
                    sx={{ display:'flex', flexDirection:'column', width:'100%', overflowY:'auto', flexGrow:1, height: `100%`}}
                    onScroll={handleScroll}
                >
                    <pre>
                        {logData.messages.map((message, index) => { return <div key={index}>{formatLogLine(message)}</div> })}
                    </pre>
                </Box>
            </CardContent>

        </Card>}
        </Box>
    </>)
}

export { LogTabContent }