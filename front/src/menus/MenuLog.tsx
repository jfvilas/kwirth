import React from 'react';
import { Collapse, Divider, Menu, MenuItem, MenuList, Typography } from "@mui/material"
import { Check, Pause, PlayArrow, RemoveCircleRounded,  Stop, ExpandLess, ExpandMore, DriveFileRenameOutline, KeyboardArrowLeft, KeyboardArrowRight, KeyboardDoubleArrowLeft, KeyboardDoubleArrowRight, PlayCircle } from '@mui/icons-material';
import { LogObject } from '../model/LogObject';

interface IProps {
    onClose:() => {};
    optionSelected: (a:string) => {};
    menuLogOpen:boolean;
    anchorMenuLog:any;
    logs:LogObject[];
    selectedLog:LogObject;
    selectedLogIndex:number;
    logPaused:boolean;
}
  
const MenuLog: React.FC<any> = (props:IProps) => {
    const [subMenuReorg, setSubmenuReorgOpen] = React.useState(false)
    const [subMenuActions, setSubmenuActionsOpen] = React.useState(false)
    const [subMenuOptions, setSubmenuOptionsOpen] = React.useState(false)

    const submenuOptionsClick = () => {
        if (!subMenuOptions) {
            setSubmenuActionsOpen(false);
            setSubmenuReorgOpen(false);
        }
        setSubmenuOptionsOpen(!subMenuOptions);
    }

    const submenuReorgClick = () => {
        if (!subMenuReorg) {
            setSubmenuOptionsOpen(false);
            setSubmenuActionsOpen(false);
        }
        setSubmenuReorgOpen(!subMenuReorg);
    }

    const submenuActionClick = () => {
        if (!subMenuActions) {
            setSubmenuOptionsOpen(false);
            setSubmenuReorgOpen(false);
        }
        setSubmenuActionsOpen(!subMenuActions);
    }

    const menuLogs=(
        <Menu id='menu-logs' anchorEl={props.anchorMenuLog} open={props.menuLogOpen} onClose={props.onClose}>
            <MenuList dense sx={{width:'40vh'}}>
            <MenuItem key='fa' onClick={() => props.optionSelected('fa')} sx={{ml:3}}>Convert filter to alert...</MenuItem>
            <MenuItem key='ma' onClick={() => props.optionSelected('ma')} disabled={true} sx={{ml:3}}>Manage alerts...</MenuItem>
            <Divider/>
        
            <MenuItem key='subopt' onClick={submenuOptionsClick} sx={{ml:3}}>Logging options<Typography sx={{flexGrow:1}}></Typography>{subMenuOptions ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuOptions} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='bn' onClick={() => props.optionSelected('bn')} sx={{ml: props.selectedLog?.showBackgroundNotification?0:3}}>{ props.selectedLog?.showBackgroundNotification &&  <Check/>} Show background notifications</MenuItem>
                <MenuItem key='ts' onClick={() => props.optionSelected('ts')} disabled={props.selectedLog.started} sx={{ml: props.selectedLog?.addTimestamp?0:3}}>{ props.selectedLog?.addTimestamp &&  <Check/>} Add timestamp to messages</MenuItem>
            </Collapse>

            <MenuItem key='subreorg' onClick={submenuReorgClick} sx={{ml:3}}>Organize<Typography sx={{flexGrow:1}}></Typography>{subMenuReorg ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuReorg} timeout="auto" unmountOnExit sx={{ml:5}}>
                <MenuItem key='dl' onClick={() => props.optionSelected('dl')} disabled={props.selectedLogIndex<0} sx={{ml: props.selectedLog?.default?0:3}}> {props.selectedLog?.default && <Check/>} Default log</MenuItem>
                <MenuItem key='rl' onClick={() => props.optionSelected('rl')} disabled={props.selectedLogIndex<0}><DriveFileRenameOutline/>&nbsp;Rename log</MenuItem>
                <MenuItem key='ml' onClick={() => props.optionSelected('ml')} disabled={props.selectedLogIndex===0}><KeyboardArrowLeft/>Move to left</MenuItem>
                <MenuItem key='mr' onClick={() => props.optionSelected('mr')} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardArrowRight/>Move to right</MenuItem>
                <MenuItem key='ms' onClick={() => props.optionSelected('ms')} disabled={props.selectedLogIndex===0}><KeyboardDoubleArrowLeft/>&nbsp;Move to start</MenuItem>
                <MenuItem key='me' onClick={() => props.optionSelected('me')} disabled={props.selectedLogIndex===props.logs.length-1}><KeyboardDoubleArrowRight/>&nbsp;Move to end</MenuItem>
            </Collapse>
            
            <MenuItem key='subaction' onClick={submenuActionClick} sx={{ml:3}}>Actions<Typography sx={{flexGrow:1}}></Typography>{subMenuActions ? <ExpandLess/> : <ExpandMore/>}</MenuItem>
            <Collapse in={subMenuActions} timeout="auto" unmountOnExit sx={{ml:5}}>
                {/* <MenuItem key='logstart' onClick={() => props.optionSelected('ls')} disabled={props.startDisabled}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logpr' onClick={() => props.optionSelected('lpr')} disabled={!props.startDisabled}>{props.logPaused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='logstop' onClick={() => props.optionSelected('lstop')} disabled={!props.startDisabled}><Stop/>&nbsp;Stop</MenuItem> */}
                <MenuItem key='logstart' onClick={() => props.optionSelected('ls')} disabled={props.selectedLog.started}><PlayCircle/>&nbsp;Start</MenuItem>
                <MenuItem key='logpr' onClick={() => props.optionSelected('lpr')} disabled={!props.selectedLog.started}>{props.logPaused?<><PlayArrow/>Resume</>:<><Pause/>Pause</>}</MenuItem>
                <MenuItem key='logstop' onClick={() => props.optionSelected('lstop')} disabled={!props.selectedLog.started}><Stop/>&nbsp;Stop</MenuItem>

                <MenuItem key='logremove' onClick={() => props.optionSelected('lr')} ><RemoveCircleRounded/>&nbsp;Remove</MenuItem>
            </Collapse>
            </MenuList>
        </Menu>
    );
    
    return menuLogs;
}

export default MenuLog;