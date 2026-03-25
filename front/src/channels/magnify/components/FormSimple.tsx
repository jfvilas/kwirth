import { Button, DialogActions, Menu, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material'
import React, { useRef, useState, useEffect } from 'react'
import { objectClone } from '../Tools'

interface IFormSimpleProps {
    onApply: (values: any) => void
    onClose: () => void
    anchorParent: Element | null
    model: any
}

const FormSimple: React.FC<IFormSimpleProps> = (props: IFormSimpleProps) => {
    const [, setRefresh] = useState(0)
    const data = useRef<any>(objectClone(props.model))
    const [asyncResults, setAsyncResults] = useState<{ [key: string]: any }>({})

    useEffect(() => {
        Object.keys(data.current).forEach(key => {
            const item = data.current[key]
            if (item && typeof item === 'object' && item.text && typeof props.model[key]?.asyncAction) {
                props.model[key].asyncAction().then((result: any) => {
                    setAsyncResults(prev => ({ ...prev, [key]: result }))
                })
            }
        })
    }, [])

    const handleRefresh = () => setRefresh(prev => prev + 1)

    const apply = () => {
        props.onApply(objectClone(data.current))
    }

    return (
        <Menu open={Boolean(props.anchorParent)} anchorEl={props.anchorParent} onClose={props.onClose}>
            <Stack direction={'column'} width={'320px'} p={2} spacing={1.5}>
                {Object.keys(data.current).map((key, index) => {
                    const value = data.current[key]

                    return (
                        <Stack key={index} direction={'row'} alignItems={'center'} justifyContent={'space-between'} spacing={2}>
                            <Typography variant='body2' sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                                {key}:
                            </Typography>

                            {typeof value === 'boolean' && (
                                <Switch checked={value} onChange={(e) => { data.current[key] = e.target.checked; handleRefresh(); }} />
                            )}

                            {typeof value === 'number' && (
                                <TextField type='number' variant='standard' value={value} onChange={(e) => { data.current[key] = Number(e.target.value); handleRefresh(); }} slotProps={{ htmlInput: { style: { textAlign: 'right', width: '80px' } } }}/>
                            )}

                            {value && typeof value === 'object' && value.options && value.value !== undefined && (
                                <Select  variant='standard' value={value.value} onChange={(e) => { data.current[key].value = e.target.value; handleRefresh(); }} sx={{ minWidth: '100px' }}>
                                    {value.options.map((opt: string, i: number) => (
                                        <MenuItem key={i} value={opt}>{opt}</MenuItem>
                                    ))}
                                </Select>
                            )}

                            {value && typeof value === 'object' && value.button && (
                                <Button variant='outlined' size='small' onClick={() => props.model[key].action()}>
                                    {value.button}
                                </Button>
                            )}

                            {value && typeof value === 'object' && value.text && (
                                <Typography variant='body2' color='text.secondary'>
                                    {asyncResults[key] !== undefined ? asyncResults[key] : '...'}
                                </Typography>
                            )}
                        </Stack>
                    );
                })}
            </Stack>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={props.onClose} color='inherit'>Cancel</Button>
                <Button onClick={apply} variant='contained' color='primary'>Apply</Button>
            </DialogActions>
        </Menu>
    )
}

export { FormSimple }