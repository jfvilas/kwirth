import React from 'react';
import { Divider, MenuItem, MenuList } from "@mui/material"
import { BrowserUpdated, CreateNewFolderTwoTone, DeleteTwoTone, Edit, ExitToApp, FileOpenTwoTone, ImportExport, Key, Person, SaveAsTwoTone, SaveTwoTone, Settings } from '@mui/icons-material';
import { User } from '../model/User';

enum MenuDrawerOption {
    NewView,
    OpenView,
    SaveView,
    SaveViewAs,
    DeleteView,
    ImportBoards,
    ExportBoards,
    Settings,
    ManageCluster,
    UserSecurity,
    UpdateKwirth,
    ApiSecurity,
    Exit
}
interface IProps {
    optionSelected: (opt:MenuDrawerOption) => {};
    uploadSelected: (a:React.ChangeEvent<HTMLInputElement>) => {};
    user:User;
  }
  
const MenuDrawer: React.FC<any> = (props:IProps) => {

    const optionSelected = (opt:MenuDrawerOption) => {
        props.optionSelected(opt);
    }

    const menu=(
        <MenuList sx={{height:'85vh'}}>
            <MenuItem key='new' onClick={() => optionSelected(MenuDrawerOption.NewView)}><CreateNewFolderTwoTone/>&nbsp;New</MenuItem>
            <MenuItem key='open' onClick={() => optionSelected(MenuDrawerOption.OpenView)}><FileOpenTwoTone/>&nbsp;Load</MenuItem>
            <MenuItem key='save' onClick={() => optionSelected(MenuDrawerOption.SaveView)}><SaveTwoTone/>&nbsp;Save</MenuItem>
            <MenuItem key='saveas' onClick={() => optionSelected(MenuDrawerOption.SaveViewAs)}><SaveAsTwoTone/>&nbsp;Save as...</MenuItem>
            <MenuItem key='delete' onClick={() => optionSelected(MenuDrawerOption.DeleteView)}><DeleteTwoTone/>&nbsp;Delete</MenuItem>
            <Divider/>
            <MenuItem key='boardexp' onClick={() => optionSelected(MenuDrawerOption.ExportBoards)}><ImportExport/>&nbsp;Export all boards (to downloadable file)</MenuItem>
            <MenuItem key='boardimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={(event) => props.uploadSelected(event)}/><ImportExport/>&nbsp;Import new boards from file (and merge overwriting)</MenuItem>
            <MenuItem key='settings' onClick={() => optionSelected(MenuDrawerOption.Settings)}><Settings/>&nbsp;Settings</MenuItem>
            <Divider/>
            { props.user.scope==='cluster' && 
                <div>
                    <MenuItem key='mc' onClick={() => optionSelected(MenuDrawerOption.ManageCluster)}><Edit/>&nbsp;Manage cluster list</MenuItem>
                    <MenuItem key='asec' onClick={() => optionSelected(MenuDrawerOption.ApiSecurity)}><Key/>&nbsp;API Security</MenuItem>
                    <MenuItem key='usec' onClick={() => optionSelected(MenuDrawerOption.UserSecurity)}><Person />&nbsp;User security</MenuItem>
                    <Divider/>
                    <MenuItem key='ukwirth' onClick={() => optionSelected(MenuDrawerOption.UpdateKwirth)}><BrowserUpdated />&nbsp;Update Kwirth</MenuItem>
                    <Divider/>
                </div>
            }
            <MenuItem key='exit' onClick={() => optionSelected(MenuDrawerOption.Exit)}><ExitToApp />&nbsp;Exit Kwirth</MenuItem>
        </MenuList>
    );
    
    return menu;
};

export { MenuDrawer, MenuDrawerOption };
