import React, { useRef, useState } from 'react'
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Box, Button, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import { MagnifyUserSettings } from '../MagnifyUserSettings'
import { IFileObject } from '@jfvilas/react-file-manager'
import { IChannelObject } from '../../IChannel'


interface IProps {
    channelObject: IChannelObject
    settings: MagnifyUserSettings
    files: IFileObject[]
    onReload?: () => void
}

const UserSettings: React.FC<IProps> = (props:IProps) => {
    const [logLines, setLogLines] = useState(props.settings.logLines)
    const filterRef = useRef<HTMLInputElement>(null)

    const saveGeneral = () => {
    }
    
    const saveChannels = () => {
        props.settings.logLines = logLines
    }

    
    const changesDetectedGeneral = () => {
        return false
    }
    const changesDetectedChannels = () => {
        if (props.settings.logLines !== logLines) return true
        
        return false
    }
    
    const reload = () => {
        if (props.onReload) props.onReload()
    }

    const showFiles = () => {
        console.log(props.files.filter(f => f.name.includes(filterRef.current!.value) || f.path.includes(filterRef.current!.value)))
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
            <AccordionActions>
                <Button onClick={saveGeneral} disabled={!changesDetectedGeneral()}>Save</Button>
            </AccordionActions>
        </Accordion>
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Channels</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <TextField value={logLines} onChange={(event) => {setLogLines(+event.target.value)}} variant='standard' label='Max messages' SelectProps={{native: true}} type='number' fullWidth />
            </AccordionDetails>
            <AccordionActions>
                <Button onClick={saveChannels} disabled={!changesDetectedChannels()}>Save</Button>
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
                </Stack>
            </AccordionDetails>
            <AccordionActions>
            </AccordionActions>
        </Accordion>

        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography component="span"><b>Data</b></Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Stack direction={'row'}>
                    <Stack direction={'column'} sx={{width:'59%'}}>
                        <FormGroup>
                        { props.settings.dataSettings.all.map( allsetting => {
                            return (
                                <FormControlLabel control={<Checkbox checked={props.settings.dataSettings.source.some(s => s===allsetting)}/>} label={allsetting}/>
                            )
                        })} 
                        </FormGroup>
                    </Stack>
                    <Stack direction={'column'} sx={{width:'100%'}}>
                        { props.settings.dataSettings.all.map( allsetting => {
                            return (
                                <FormControlLabel control={<Checkbox checked={props.settings.dataSettings.sync.some(s => s===allsetting)}/>} label={allsetting}/>
                            )
                        })} 
                    </Stack>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
            </AccordionActions>
        </Accordion>
    </Box>
    
    }

export { UserSettings }