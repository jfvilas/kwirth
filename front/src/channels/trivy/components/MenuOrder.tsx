import React from 'react'
import { Box, Divider, Menu, MenuItem, MenuList } from '@mui/material'
import { Check as CheckIcon } from '@mui/icons-material'

interface IMenuOrderProps {
    anchorParent: Element
    onClose: () => void
    onReorder: (soruce:'vuln'|'audit'|'exposed', order:'a'|'d') => void
    orderSource: 'vuln'|'audit'|'exposed',
    orderType:'a'|'d'
}

const MenuOrder: React.FC<IMenuOrderProps> = (props:IMenuOrderProps) => {
    return (
        <Menu anchorEl={props.anchorParent} open={true} onClose={props.onClose}>
            <MenuList dense sx={{ width: '180px' }}>
                <MenuItem onClick={() => props.onReorder(props.orderSource, 'a')}>{props.orderType === 'a' ? <CheckIcon /> : <Box sx={{ width: '26px' }} />}Ascending</MenuItem>
                <MenuItem onClick={() => props.onReorder(props.orderSource, 'd')}>{props.orderType === 'd' ? <CheckIcon /> : <Box sx={{ width: '26px' }} />}Descending</MenuItem>
                <Divider />
                <MenuItem onClick={() => props.onReorder('vuln', props.orderType)}>{props.orderSource === 'vuln' ? <CheckIcon /> : <Box sx={{ width: '26px' }} />}Vulnerabilities</MenuItem>
                <MenuItem onClick={() => props.onReorder('audit', props.orderType)}>{props.orderSource === 'audit' ? <CheckIcon /> : <Box sx={{ width: '26px' }} />}Config audit</MenuItem>
                <MenuItem onClick={() => props.onReorder('exposed', props.orderType)}>{props.orderSource === 'exposed' ? <CheckIcon /> : <Box sx={{ width: '26px' }} />}Exposed secrets</MenuItem>
            </MenuList>
        </Menu>
    )
}

export { MenuOrder }