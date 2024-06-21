import React from 'react';
import { Collapse, Divider, Menu, MenuItem, MenuList, Typography } from "@mui/material"
import { Check, Pause, PlayArrow, RemoveCircleRounded,  Stop, ExpandLess, ExpandMore, DriveFileRenameOutline, KeyboardArrowLeft, KeyboardArrowRight, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, PlayCircle, RestartAlt } from '@mui/icons-material';
import { LogObject } from '../model/LogObject';

interface IProps {
    onClose:() => {};
    optionSelected: (a:string) => {};
    anchorMenuLog:any;
    logs:LogObject[];
    selectedLog:LogObject;
    selectedLogIndex:number;
}

const MenuLog: React.FC<any> = (props:IProps) => {
    const [subMenuOptionsOpen, setSubmenuOptionsOpen] = React.useState(false)
    const [subMenuOrganizeOpen, setSubmenuOrganizeOpen] = React.useState(false)
    const [subMenuActionsOpen, setSubmenuActionsOpen] = React.useState(false)
    const [subMenuManageOpen, setSubmenuManageOpen] = React.useState(false)

    const submenuOptionsClick = () => {
        if (!subMenuOptionsOpen) {
            setSubmenuActionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuManageOpen(false);
        }
        setSubmenuOptionsOpen(!subMenuOptionsOpen);
    }

    const submenuOrganizeClick = () => {
        if (!subMenuOrganizeOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuActionsOpen(false);
            setSubmenuManageOpen(false);
        }
        setSubmenuOrganizeOpen(!subMenuOrganizeOpen);
    }

    const submenuActionClick = () => {
        if (!subMenuActionsOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuManageOpen(false);
        }
        setSubmenuActionsOpen(!subMenuActionsOpen);
    }

    const submenuManageClick = () => {
        if (!subMenuManageOpen) {
            setSubmenuOptionsOpen(false);
            setSubmenuOrganizeOpen(false);
            setSubmenuActionsOpen(false);
        }
        setSubmenuManageOpen(!subMenuManageOpen);
    }

    const menuLogs=(
        <Menu id='menu-logs' anchorEl={props.anchorMenuLog} open={Boolean(props.anchorMenuLog)} onClose={props.onClose}>
            <MenuList dense sx={{width:'40vh'}}>
            <MenuItem key='fa' onClick={() => props.optionSelected('fa')} sx={{ml:3}}>Convert filter to alert...</MenuItem>
            <MenuItem key='ma' onClick={() => props.optionSelected('ma')} disabled={true} sx={{ml:3}}>Manage alerts...</MenuItem>
            <Divider/>
        
            <MenuItem key='subopt' onClick={submenuOptionsClick} sx={{ml:3}}>Logging options<Typography sx={{flexGrow:1}}></Typography>{subMenuOptionsOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuOptionsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='bn' onClick={() => props.optionSelected('bn')} sx={{ml: props.selectedLog?.showBackgroundNotification?0:3}}>{ props.selectedLog?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
                <MenuItem key='ts' onClick={() => props.optionSelected('ts')} disabled={props.selectedLog.started} sx={{ml: props.selectedLog?.addTimestamp?0:3}}>{ props.selectedLog?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
            </Collapse>

            <MenuItem key='subreorg' onClick={submenuOrganizeClick} sx={{ml:3}}>Organize<Typography sx={{flexGrow:1}}></Typography>{subMenuOrganizeOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuOrganizeOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='dl' onClick={() => props.optionSelected('dl')} disabled={props.selectedLogIndex<0} sx={{ml: props.selectedLog?.default?0:3}}> {props.selectedLog?.default && <Check/>} Default log</MenuItem>
                <MenuItem key='rl' onClick={() => props.optionSelected('rl')} disabled={props.selectedLogIndex<0}><DriveFileRenameOutline/>&nbsp;Rename log</MenuItem>
                <MenuItem key='ml' onClick={() => props.optionSelected('ml')} disabled={props.selectedLogIndex===0}><KeyboardArrowLeft/>Move to left</MenuItem>
                <MenuItem key='mr' onClick={() => props.optionSelected('mr')} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardArrowRight/>Move to right</MenuItem>
                <MenuItem key='ms' onClick={() => props.optionSelected('ms')} disabled={props.selectedLogIndex===0}><KeyboardDoubleArrowLeft/>&nbsp;Move to start</MenuItem>
                <MenuItem key='me' onClick={() => props.optionSelected('me')} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardDoubleArrowRight/>&nbsp;Move to end</MenuItem>
            </Collapse>
            
            <MenuItem key='subaction' onClick={submenuActionClick} sx={{ml:3}}>Actions<Typography sx={{flexGrow:1}}></Typography>{subMenuActionsOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuActionsOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='logstart' onClick={() => props.optionSelected('ls')} disabled={props.selectedLog.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logpr' onClick={() => props.optionSelected('lpr')} disabled={!props.selectedLog.started}>{props.selectedLog.paused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='logstop' onClick={() => props.optionSelected('lstop')} disabled={!props.selectedLog.started}><Stop/>&nbsp;Stop</MenuItem>
                <MenuItem key='logremove' onClick={() => props.optionSelected('lr')} ><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
            </Collapse>

            <MenuItem key='submanage' onClick={submenuManageClick} sx={{ml:3}}>Manage<Typography sx={{flexGrow:1}}></Typography>{subMenuManageOpen ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuManageOpen} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='manstart' onClick={() => props.optionSelected('manrestart')} disabled={props.selectedLog.scope!=='deployment'}><RestartAlt/>&nbsp;Restart</MenuItem>
            </Collapse>
            </MenuList>
        </Menu>
    );
    
    return menuLogs;
}

export default MenuLog;