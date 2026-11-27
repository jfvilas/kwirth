import React, { useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { yaml } from '@codemirror/lang-yaml'
import { openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { defaultKeymap } from '@codemirror/commands'
import { TasklistSession } from '../TasklistSession'
import { INotepadWindow } from '../TasklistSessionTypes'
import { IMenuBarEntry, MenuBar, MessageBox } from '../luna/LunaControls'
import { ErrorIcon, NotepadIcon, WarningIcon } from '../luna/LunaIcons'
import { LunaWindow } from '../luna/LunaWindow'
import { NOTEPAD_HEIGHT, NOTEPAD_WIDTH } from './Placement'

export interface INotepadWindowProps {
    session: TasklistSession
    notepad: INotepadWindow
    desktop: HTMLElement | null
    desktopWidth: number
    desktopHeight: number
    zIndex: number
}

/*
    XP's Notepad as a window of the desktop (PRD D16, D18, D19): a container's log (read only, opened at its end), an
    object's YAML (File → Save or Ctrl+S applies it) or a blank page from Start. It moves, resizes, maximises and
    minimises like any window; closing it with changes asks first, as Notepad did, and an error saving is said over
    it, with the text left as it was typed. The editor is Kwirth's (the CodeMirror the core lends its plugins, as
    magnify's): YAML highlighted when it is YAML, and search (Ctrl+F) always.
*/
export const NotepadWindow: React.FC<INotepadWindowProps> = ({ session, notepad, desktop, desktopWidth, desktopHeight, zIndex }) => {
    const [wrap, setWrap] = useState(false)
    const [message, setMessage] = useState<JSX.Element>()
    const viewRef = useRef<EditorView>()
    const { id, readOnly } = notepad
    const dirty = notepad.text !== notepad.saved
    const close = () => session.closeNotepad(id)

    const extensions = useMemo(() => [
        // readOnly keeps the document as it is; editable keeps the caret and the keyboard out, as a log's window should
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        ...(notepad.yaml ? [yaml()] : []),
        ...(wrap ? [EditorView.lineWrapping] : []),
        search({ top: true }),
        keymap.of([...defaultKeymap, ...searchKeymap])
    ], [readOnly, notepad.yaml, wrap])

    const created = (view: EditorView) => {
        viewRef.current = view
        // a log is read from its end, as the newest lines are
        if (readOnly) view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true })
    }

    const save = async (): Promise<boolean> => {
        if (!notepad.save) return true
        const text = notepad.text
        const error = await notepad.save(text)
        if (error === undefined) {
            session.setNotepadText(id, text, true)
            return true
        }
        setMessage(<MessageBox title='Notepad' icon={<ErrorIcon />} lines={['The changes could not be saved.', error]} onClose={() => setMessage(undefined)}
            buttons={[{ label: 'OK', onClick: () => setMessage(undefined) }]} testId='tl-notepad-error' />)
        return false
    }

    // A blank Notepad has nowhere to save to: its changes are only asked about when they can be saved.
    const exit = () => {
        if (readOnly || !dirty || !notepad.save) { close(); return }
        setMessage(<MessageBox title='Notepad' icon={<WarningIcon />} lines={[`The text in the ${notepad.title} file has changed.`, 'Do you want to save the changes?']}
            onClose={() => setMessage(undefined)} testId='tl-notepad-ask'
            buttons={[
                { label: 'Yes', onClick: () => { setMessage(undefined); void save().then(ok => { if (ok) close() }) } },
                { label: 'No', onClick: close },
                { label: 'Cancel', onClick: () => setMessage(undefined) }
            ]} />)
    }

    const menus: IMenuBarEntry[] = [
        {
            label: 'File', items: [
                { label: 'New', onClick: () => session.openNotepad('Untitled', '', false, false) },
                { label: 'Save', disabled: readOnly || !notepad.save, onClick: () => void save() },
                {},
                { label: 'Exit', onClick: exit }
            ]
        },
        {
            label: 'Edit', items: [
                { label: 'Find...', onClick: () => { if (viewRef.current) openSearchPanel(viewRef.current) } },
                { label: 'Select All', onClick: () => { const v = viewRef.current; if (v) { v.focus(); v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } }) } } },
                { label: 'Time/Date', disabled: readOnly, onClick: () => {
                    const v = viewRef.current
                    if (v) v.dispatch(v.state.replaceSelection(new Date().toLocaleString()))
                } }
            ]
        },
        {
            label: 'Format', items: [
                { label: 'Word Wrap', checked: wrap, onClick: () => setWrap(!wrap) },
                { label: 'Font...', disabled: true }
            ]
        },
        { label: 'View', items: [{ label: 'Status Bar', disabled: true }] },
        { label: 'Help', items: [{ label: 'Help Topics', disabled: true }] }
    ]

    return (
        <LunaWindow title={`${notepad.title} - Notepad`} icon={<NotepadIcon />} frame={notepad.frame} firstWidth={NOTEPAD_WIDTH} firstHeight={NOTEPAD_HEIGHT}
            desktop={desktop} desktopWidth={desktopWidth} desktopHeight={desktopHeight} active={session.activeWindow() === id} zIndex={zIndex}
            onFrame={patch => session.setFrame(id, patch)} onActivate={() => session.activate(id)} onClose={exit} testId='tl-notepad'>
            <div className='tl-frame tl-notepad'>
                <MenuBar entries={menus} />
                <div className='tl-notepad-text' data-testid='tl-notepad-text' aria-label={notepad.title}
                    onKeyDown={e => { if (e.key === 's' && (e.ctrlKey || e.metaKey) && !readOnly && notepad.save) { e.preventDefault(); void save() } }}>
                    <CodeMirror value={notepad.text} onChange={text => session.setNotepadText(id, text)} theme='light' height='100%' extensions={extensions}
                        onCreateEditor={created} basicSetup={{ foldGutter: false, highlightActiveLine: !readOnly, autocompletion: false, lineNumbers: notepad.yaml }} />
                </div>
            </div>
            {message}
        </LunaWindow>
    )
}
