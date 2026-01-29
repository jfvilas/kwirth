import React, { useRef, useState } from 'react'
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import { allKinds, MagnifyUserPreferences } from '../MagnifyUserPreferences'
import { IFileObject } from '@jfvilas/react-file-manager'
import { IChannelObject } from '../../IChannel'


interface IProps {
    channelObject: IChannelObject
    preferences: MagnifyUserPreferences
    files: IFileObject[]
    onReload?: () => void
}

const UserPreferences: React.FC<IProps> = (props:IProps) => {
    const [logLines, setLogLines] = useState(props.preferences.logLines)
    const [tracing, setTracing ] = useState(props.preferences.tracing)
    const [sourceList, setSourceList] = useState<string[]>(props.preferences.dataConfig?.source)
    const [syncList, setSyncList] = useState<string[]>(props.preferences.dataConfig?.sync)
    const filterRef = useRef<HTMLInputElement>(null)

    const save = () => {
        if (!props.channelObject.writeChannelUserPreferences) return
        props.preferences.dataConfig.source = sourceList
        props.preferences.dataConfig.sync = syncList
        props.preferences.logLines = logLines
        props.preferences.tracing = tracing
        props.channelObject.writeChannelUserPreferences(props.channelObject.channel.channelId, props.preferences)
    }
    
    const reload = () => {
        if (props.onReload) props.onReload()
    }

    const showFiles = () => {
        console.log(props.files.filter(f => f.name.includes(filterRef.current!.value) || f.path.includes(filterRef.current!.value)))
    }

    const changeKind = (type:string, kind:string) => {
        let list=sourceList
        if (type==='sync') list=syncList

        if (list.includes(kind))
            list=list.filter(k => k!==kind)
        else
            list.push(kind)
        if (type==='source') setSourceList([...list])
        if (type==='sync') setSyncList([...list])
    }

    return <Box sx={{m:1}}>
        <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>General</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse
                malesuada lacus ex, sit amet blandit leo lobortis eget.
            </AccordionDetails>
        </Accordion>
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>External content</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <TextField value={logLines} onChange={(event) => {setLogLines(+event.target.value)}} variant='standard' label='Max messages' SelectProps={{native: true}} type='number' fullWidth />
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Data management</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'row'}>
                    <Stack direction={'column'} sx={{width:'59%'}}>
                        <Typography fontWeight={700}>Source</Typography>
                        { allKinds.map(kind => {
                            return (
                                <FormControlLabel key={kind} control={<Checkbox onChange={() => changeKind('source', kind)} checked={sourceList.some(s => s===kind)}/>} label={kind}/>
                            )
                        })} 
                    </Stack>
                    <Stack direction={'column'} sx={{width:'100%'}}>
                        <Typography fontWeight={700}>Sync</Typography>
                        { allKinds.map( kind => {
                            return (
                                <FormControlLabel key={kind} control={<Checkbox onChange={() => changeKind('sync', kind)} checked={syncList.some(s => s===kind)}/>} label={kind}/>
                            )
                        })} 
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save}>Save</Button>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Debug</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'column'} >
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Show files collection on browser console ({props.files.length} objects, {(JSON.stringify(props.files).length/1024/1024).toFixed(2)}  MB approx.)</Typography>
                        <TextField inputRef={filterRef} label='Text filter...' variant='standard'></TextField>
                        <Button onClick={reload}>Reload</Button>
                        <Button onClick={showFiles}>Show files</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Metrics names</Typography>
                        <Button onClick={() => console.log(props.channelObject.metricsList?.keys())}>Show metrics</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Objects</Typography>
                        <Button onClick={() => console.log(props.channelObject)}>Show object</Button>
                    </Stack>
                    <Stack direction={'row'} alignItems={'center'}>
                        <Typography sx={{flexGrow:1}}>Message tracing (send to console received messages)</Typography>
                        <Checkbox checked={tracing} onChange={() => setTracing(!tracing)}/>
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save}>Save</Button>
            </AccordionActions>
        </Accordion>

    </Box>
    
    }

export { UserPreferences }