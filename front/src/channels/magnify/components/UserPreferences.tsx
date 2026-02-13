import React, { useRef, useState } from 'react'
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import { allKinds, IKind, MagnifyUserPreferences } from '../MagnifyUserPreferences'
import { IFileObject } from '@jfvilas/react-file-manager'
import { IChannelObject } from '../../IChannel'

interface IProps {
    channelObject: IChannelObject
    preferences: MagnifyUserPreferences
    files: IFileObject[]
    onReload?: () => void
}

//+++ las userpreferences siguen dando undefined al arrancar el canal
const UserPreferences: React.FC<IProps> = (props:IProps) => {
    const [logLines, setLogLines] = useState(props.preferences.logLines)
    const [tracing, setTracing ] = useState(props.preferences.tracing)
    const [sourceList, setSourceList] = useState<IKind[]>(props.preferences.dataConfig?.source)
    const [syncList, setSyncList] = useState<IKind[]>(props.preferences.dataConfig?.sync)
    const [dataChanged, setDataChanged] = useState(false)
    const [debugChanged, setDebugChanged] = useState(false)
    const [externalChanged, setExternalChanged] = useState(false)
    const filterRef = useRef<HTMLInputElement>(null)


    const save = () => {
        if (!props.channelObject.writeChannelUserPreferences) return
        props.preferences.dataConfig.source = sourceList
        props.preferences.dataConfig.sync = syncList
        props.preferences.logLines = logLines
        props.preferences.tracing = tracing
        props.channelObject.writeChannelUserPreferences(props.channelObject.channel.channelId, props.preferences)
        setDataChanged(false)
        setDebugChanged(false)
        setExternalChanged(false)
    }
    
    const reload = () => {
        if (props.onReload) props.onReload()
    }

    const showFiles = () => {
        console.log(props.files.filter(f => f.name.includes(filterRef.current!.value) || f.path.includes(filterRef.current!.value)))
    }

    const changeKind = (type:string, kind:IKind) => {
        let list=sourceList
        if (type==='sync') list=syncList

        if (list.some(k => k.name===kind.name))
            list=list.filter(k => k.name!==kind.name)
        else
            list.push(kind)
        if (type==='source') setSourceList([...list])
        if (type==='sync') setSyncList([...list])
        setDataChanged(true)
    }

    return <Box bgcolor={'#f1f1f1'} width={'100%'} minHeight={'calc(100% - 16px)'} sx={{p:1}}> 
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
                <TextField value={logLines} onChange={(event) => {setLogLines(+event.target.value); setExternalChanged(true)}} variant='standard' label='Max messages' SelectProps={{native: true}} type='number' fullWidth />
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!externalChanged}>Save</Button>
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
                                <FormControlLabel key={kind.name} control={<Checkbox onChange={() => changeKind('source', kind)} checked={sourceList.some(s => s.name===kind.name)}/>} label={kind.name}/>
                            )
                        })} 
                    </Stack>
                    <Stack direction={'column'} sx={{width:'100%'}}>
                        <Typography fontWeight={700}>Sync</Typography>
                        { allKinds.map(kind => {
                            return (
                                <FormControlLabel key={kind.name} control={<Checkbox onChange={() => changeKind('sync', kind)} checked={syncList.some(s => s.name===kind.name)}/>} label={kind.name}/>
                            )
                        })} 
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!dataChanged}>Save</Button>
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
                        <Checkbox checked={tracing} onChange={() => { setTracing(!tracing); setDebugChanged(true)}}/>
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={save} disabled={!debugChanged}>Save</Button>
            </AccordionActions>
        </Accordion>
    </Box>
    }

export { UserPreferences }