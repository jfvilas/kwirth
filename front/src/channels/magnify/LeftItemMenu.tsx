import { Box, Divider, Menu, MenuItem, MenuList, Stack, Typography } from '@mui/material'
import React from 'react'


interface IProps {
    f: any
    onClose?:() => void
    onOptionSelected: (container:string) => void
    includeAllContainers: boolean
    anchorParent: Element
}

const LeftItemContainersMenu: React.FC<IProps> = (props:IProps) => {
    return <Menu id='menu-logs' anchorEl={props.anchorParent} open={Boolean(props.anchorParent)} onClose={props.onClose}>
        <MenuList dense sx={{minWidth: 120}}>
            {
                props.f.data.origin.status.containerStatuses.map ( (cs:any) =>  {

                    let color='orange'
                    if (cs.started) {
                        color='green'
                        if (props.f.data.origin.metadata.deletionTimestamp) color = 'blue'
                    }
                    else {
                        if (cs.state.terminated) color = 'gray'
                    }
                    return <MenuItem key={cs.name} onClick={() => props.onOptionSelected(cs.name)}>
                        <Stack direction={'row'} alignItems={'center'}>
                            <Box sx={{ width: '10px', height: '10px', backgroundColor: color, margin: '1px', display: 'inline-block' }}/>
                            <Typography>&nbsp;{cs.name}</Typography>
                        </Stack>
                    </MenuItem>
                })
            }
            { props.includeAllContainers && 
                <>
                    <Divider/>
                    <MenuItem key={'all'} onClick={() => props.onOptionSelected('*all')}>
                        <Typography>All containers</Typography>
                    </MenuItem>
                </>
            }
        </MenuList>
    </Menu>
}

export { LeftItemContainersMenu as LeftItemMenu }