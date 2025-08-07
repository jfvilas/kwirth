import React, { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import { Cluster } from '../../model/Cluster'
import { addGetAuthorization } from '../../tools/AuthorizationManagement'

interface IProps {
    onClose:(action:string) => void
    cluster: Cluster
}

const SettingsTrivy: React.FC<IProps> = (props:IProps) => {
    const [status, setStatus] = useState('?')

    const getStatus = async () => {
        let result = await (await fetch (`${props.cluster.url}/config/trivy?action=status`, addGetAuthorization(props.cluster.accessString)))
        setStatus(await result.text())
    }
    
    useEffect( () => {
        // only first time
        getStatus()
    })

    return (<>
        <Dialog open={true} >
            <DialogTitle>Cluster settings</DialogTitle>
            <DialogContent >
                <Stack spacing={2} direction={'column'} sx={{width: '40vh' }}>
                    <Typography>Status: {status}</Typography>
                    <Button onClick={() => props.onClose('install')}>INSTALL</Button>
                    <Button onClick={() => props.onClose('remove')}>REMOVE</Button>
                    <Typography>Select scan mode: </Typography>
                    <Button onClick={() => props.onClose('configfs')}>FILESYSTEM</Button>
                    <Button onClick={() => props.onClose('configimg')}>IMAGE</Button>
                </Stack>
            </DialogContent>
            <DialogActions>
                {/* <Button onClick={() => props.onClose(clusterMetricsInterval)}>OK</Button> */}
                <Button onClick={() => props.onClose('')}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SettingsTrivy }