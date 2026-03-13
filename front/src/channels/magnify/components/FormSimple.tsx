import { Button, DialogActions, Menu, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material'
import React, { useRef, useState } from 'react'
import { objectClone } from '../Tools'

interface IFormSimpleProps {
    onApply: (values:any) => void
    onClose: () => void
    anchorParent: Element
    model: any
}

const FormSimple: React.FC<IFormSimpleProps> = (props:IFormSimpleProps) => {
    const [ , setRefresh ] = useState(0)
    const data = useRef<any>(objectClone(props.model))

    const apply = () => {
        props.onApply(objectClone(data.current))
    }

    return (
        <Menu open={true} anchorEl={props.anchorParent} onClose={props.onClose}>
                <Stack direction={'column'} width={'300px'} p={2}>
                {
                    Object.keys(data.current).map( (key, index) => {
                        return <Stack direction={'row'} alignItems={'center'} justifyContent={'space-between'}>
                            <Typography>{key}</Typography>
                            {
                                ((typeof data.current[key]==='boolean') && 
                                    <Switch onClick={() => { data.current[key] = !data.current[key]; setRefresh(Math.random())}} checked={data.current[key]}/>) ||

                                ((typeof data.current[key]==='number') && 
                                    <TextField onChange={(event) => {data.current[key]=+event.target.value; setRefresh(Math.random())}} value={data.current[key].toString()} variant='standard' type={'number'} slotProps={{htmlInput: {style:{width:'120px', textAlign:'right'}}}} />) ||

                                ((typeof data.current[key]==='object' && (data.current[key] as any).options && (data.current[key] as any).value) && 
                                    <Select value={(data.current[key] as any).value} onChange={(event) => {data.current[key].value=event.target.value; setRefresh(Math.random())}} variant='standard'>
                                        { (data.current[key] as any).options.map((o: string) => <MenuItem value={o}>{o}</MenuItem>) }
                                    </Select>
                                )

                            }
                        </Stack>
                    })
                }
                </Stack>
            <DialogActions>
                <Button onClick={apply}>Apply</Button>
                <Button onClick={props.onClose}>Cancel</Button>
            </DialogActions>
        </Menu>
    )
}

export { FormSimple }