import React from 'react'
import { TasklistSession } from '../TasklistSession'
import { CONTROL_PANEL_WINDOW } from '../TasklistSessionTypes'
import { IMenuBarEntry, MenuBar } from '../luna/LunaControls'
import { ControlPanelIcon, KubernetesLogo } from '../luna/LunaIcons'
import { LunaWindow } from '../luna/LunaWindow'
import { AppletIcon, TAppletGlyph } from '../luna/ControlPanelIcons'

export const CONTROL_PANEL_WIDTH = 560
export const CONTROL_PANEL_HEIGHT = 440

// An applet of the Control Panel: its name under its icon.
export interface IControlPanelApplet {
    name: string
    glyph: TAppletGlyph
}

// XP's Control Panel in its classic view, in its order. None of them does anything yet: they are all shown disabled.
export const CONTROL_PANEL_APPLETS: IControlPanelApplet[] = [
    { name: 'Accessibility Options', glyph: 'accessibility' },
    { name: 'Add Hardware', glyph: 'hardware' },
    { name: 'Add or Remove Programs', glyph: 'programs' },
    { name: 'Administrative Tools', glyph: 'tools' },
    { name: 'Automatic Updates', glyph: 'updates' },
    { name: 'Date and Time', glyph: 'clock' },
    { name: 'Display', glyph: 'display' },
    { name: 'Folder Options', glyph: 'folder' },
    { name: 'Fonts', glyph: 'fonts' },
    { name: 'Game Controllers', glyph: 'gamepad' },
    { name: 'Internet Options', glyph: 'internet' },
    { name: 'Keyboard', glyph: 'keyboard' },
    { name: 'Mouse', glyph: 'mouse' },
    { name: 'Network Connections', glyph: 'network' },
    { name: 'Phone and Modem Options', glyph: 'phone' },
    { name: 'Power Options', glyph: 'power' },
    { name: 'Printers and Faxes', glyph: 'printer' },
    { name: 'Regional and Language Options', glyph: 'regional' },
    { name: 'Scanners and Cameras', glyph: 'camera' },
    { name: 'Scheduled Tasks', glyph: 'tasks' },
    { name: 'Security Center', glyph: 'security' },
    { name: 'Sounds and Audio Devices', glyph: 'sound' },
    { name: 'Speech', glyph: 'speech' },
    { name: 'System', glyph: 'system' },
    { name: 'Taskbar and Start Menu', glyph: 'taskbar' },
    { name: 'User Accounts', glyph: 'users' },
    { name: 'Firewall', glyph: 'firewall' },
    { name: 'Wireless Network Setup Wizard', glyph: 'wireless' }
]

const disabledMenu = (label: string, items: string[]) => ({ label, items: items.map(i => i ? { label: i, disabled: true } : {}) })

export interface IControlPanelWindowProps {
    session: TasklistSession
    desktop: HTMLElement | null
    desktopWidth: number
    desktopHeight: number
    zIndex: number
}

/*
    XP's Control Panel, an Explorer window: its menus, the Back/Forward/Up/Search/Folders/Views bar, the Address bar,
    and the applets in a grid. For now everything in it is disabled (D22): it is there to be opened, moved and
    closed, and to grow applets one by one.
*/
export const ControlPanelWindow: React.FC<IControlPanelWindowProps> = ({ session, desktop, desktopWidth, desktopHeight, zIndex }) => {
    const menus: IMenuBarEntry[] = [
        disabledMenu('File', ['Open', 'Create Shortcut', '', 'Properties']),
        disabledMenu('Edit', ['Undo', '', 'Select All', 'Invert Selection']),
        disabledMenu('View', ['Toolbars', 'Status Bar', '', 'Thumbnails', 'Tiles', 'Icons', 'List', 'Details', '', 'Refresh']),
        disabledMenu('Favorites', ['Add to Favorites...', 'Organize Favorites...']),
        disabledMenu('Tools', ['Map Network Drive...', 'Folder Options...']),
        disabledMenu('Help', ['Help and Support Center'])
    ]
    return (
        <LunaWindow title='Control Panel' icon={<ControlPanelIcon title />} frame={session.controlPanel} firstWidth={CONTROL_PANEL_WIDTH} firstHeight={CONTROL_PANEL_HEIGHT}
            desktop={desktop} desktopWidth={desktopWidth} desktopHeight={desktopHeight} active={session.activeWindow() === CONTROL_PANEL_WINDOW} zIndex={zIndex}
            onFrame={patch => session.setFrame(CONTROL_PANEL_WINDOW, patch)} onActivate={() => session.activate(CONTROL_PANEL_WINDOW)}
            onClose={session.closeControlPanel} testId='tl-control-panel'>
            <div className='tl-frame tl-cp'>
                <div className='tl-cp-menurow'>
                    <MenuBar entries={menus} />
                    <span className='tl-cp-throbber'><KubernetesLogo /></span>
                </div>
                <div className='tl-cp-toolbar'>
                    {['Back', 'Forward', 'Up', 'Search', 'Folders', 'Views'].map(b => (
                        <span key={b} className='tl-cp-tool tl-disabled' role='button' aria-label={b} aria-disabled='true'>{b}</span>
                    ))}
                </div>
                <div className='tl-cp-address'>
                    <span className='tl-cp-address-label'>Address</span>
                    <span className='tl-input tl-cp-address-box'><ControlPanelIcon title />Control Panel</span>
                    <span className='tl-cp-go tl-disabled' role='button' aria-label='Go' aria-disabled='true'>Go</span>
                </div>
                <div className='tl-cp-grid' data-testid='tl-cp-applets'>
                    {CONTROL_PANEL_APPLETS.map(a => (
                        <div key={a.name} className='tl-cp-applet tl-disabled' role='button' aria-label={a.name} aria-disabled='true' title={`${a.name} (not available yet)`}>
                            <AppletIcon glyph={a.glyph} />
                            <span>{a.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </LunaWindow>
    )
}
