import React from 'react';
import { Divider, MenuItem, MenuList } from "@mui/material"
import { BrowserUpdated, CreateNewFolderTwoTone, DeleteTwoTone, Edit, ExitToApp, FileOpenTwoTone, ImportExport, Key, Person, SaveAsTwoTone, SaveTwoTone, Settings, RemoveFromQueue } from '@mui/icons-material';

enum MenuDrawerOption {
    NewBoard,
    LoadBoard,
    SaveBoard,
    SaveBoardAs,
    DeleteBoard,
    ImportBoards,
    ExportBoards,
    SettingsUser,
    SettingsCluster,
    ManageCluster,
    UserSecurity,
    UpdateKwirth,
    InstallTrivy,
    RemoveTrivy,
    ApiSecurity,
    Exit
}

interface IProps {
    optionSelected: (opt:MenuDrawerOption) => void
    uploadSelected: (a:React.ChangeEvent<HTMLInputElement>) => void
    selectedClusterName?: string
    hasClusterScope:boolean
  }
  
const MenuDrawer: React.FC<IProps> = (props:IProps) => {

    const optionSelected = (opt:MenuDrawerOption) => {
        props.optionSelected(opt);
    }

    const menu=(
        <MenuList sx={{height:'85vh'}}>
            <MenuItem key='new' onClick={() => optionSelected(MenuDrawerOption.NewBoard)}><CreateNewFolderTwoTone/>&nbsp;New board</MenuItem>
            <MenuItem key='open' onClick={() => optionSelected(MenuDrawerOption.LoadBoard)}><FileOpenTwoTone/>&nbsp;Load board</MenuItem>
            <MenuItem key='save' onClick={() => optionSelected(MenuDrawerOption.SaveBoard)}><SaveTwoTone/>&nbsp;Save board</MenuItem>
            <MenuItem key='saveas' onClick={() => optionSelected(MenuDrawerOption.SaveBoardAs)}><SaveAsTwoTone/>&nbsp;Save board as...</MenuItem>
            <MenuItem key='delete' onClick={() => optionSelected(MenuDrawerOption.DeleteBoard)}><DeleteTwoTone/>&nbsp;Delete board...</MenuItem>
            <Divider/>
            <MenuItem key='boardexp' onClick={() => optionSelected(MenuDrawerOption.ExportBoards)}><ImportExport/>&nbsp;Export all boards (to downloadable file)</MenuItem>
            <MenuItem key='boardimp' component='label'><input type="file" hidden accept=".kwirth.json" onChange={(event) => props.uploadSelected(event)}/><ImportExport/>&nbsp;Import new boards from file (and merge overwriting)</MenuItem>
            <MenuItem key='settingsu' onClick={() => optionSelected(MenuDrawerOption.SettingsUser)}><Settings/>&nbsp;User settings</MenuItem>
            <MenuItem key='settingsc' onClick={() => optionSelected(MenuDrawerOption.SettingsCluster)} disabled={props.selectedClusterName===undefined}><Settings/>&nbsp;Cluster Settings</MenuItem>
            <Divider/>
            <MenuItem key='mc' onClick={() => optionSelected(MenuDrawerOption.ManageCluster)}><Edit/>&nbsp;Manage cluster list</MenuItem>
            <Divider/>
            { props.hasClusterScope && 
                <div>
                    <MenuItem key='asec' onClick={() => optionSelected(MenuDrawerOption.ApiSecurity)}><Key/>&nbsp;API Security</MenuItem>
                    <MenuItem key='usec' onClick={() => optionSelected(MenuDrawerOption.UserSecurity)}><Person />&nbsp;User security</MenuItem>
                    <Divider/>
                    <MenuItem key='ukwirth' onClick={() => optionSelected(MenuDrawerOption.UpdateKwirth)}><BrowserUpdated />&nbsp;Update Kwirth</MenuItem>
                    <MenuItem key='itrivy' onClick={() => optionSelected(MenuDrawerOption.InstallTrivy)}><BrowserUpdated />&nbsp;Install Trivy</MenuItem>
                    <MenuItem key='rtrivy' onClick={() => optionSelected(MenuDrawerOption.RemoveTrivy)}><RemoveFromQueue />&nbsp;Remove Trivy</MenuItem>
                    <Divider/>
                </div>
            }
            <MenuItem key='exit' onClick={() => optionSelected(MenuDrawerOption.Exit)}><ExitToApp />&nbsp;Exit Kwirth</MenuItem>
        </MenuList>
    )

    return menu
}

export { MenuDrawer, MenuDrawerOption }
