import React, { useState, useCallback, useRef } from 'react'
import { Dialog, Paper, PaperProps, Box, useTheme } from '@mui/material'
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
import { ResizableBox, ResizeCallbackData } from 'react-resizable'
import './ResizableDialog.css'

const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    const { handleAxis, ...restProps } = props
    const isSE = handleAxis === 'se'
    
    const style: React.CSSProperties = {
        position: 'absolute',
        bottom: 3,
        [isSE ? 'right' : 'left']: 3,
        width: '12px',
        height: '12px',
        borderRight: isSE ? '3px solid #bdbdbd' : 'none',
        borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
        borderBottom: '3px solid #bdbdbd',
        cursor: isSE ? 'nwse-resize' : 'sw-resize',
        zIndex: 20,
        borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
    }

    return <div ref={ref} style={style} {...restProps} />
})

interface DraggablePaperProps extends Omit<PaperProps, 'onDrag'> {
  nodeRef: React.RefObject<HTMLDivElement>
  position: { x: number; y: number }
  onDrag: (e: DraggableEvent, data: DraggableData) => void
  onStart: (e: DraggableEvent, data: DraggableData) => void
  onStop: (e: DraggableEvent, data: DraggableData) => void
  disabled?: boolean
}

const PaperComponent = React.forwardRef<HTMLDivElement, DraggablePaperProps>((props, ref) => {
  const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
  
  return (
    <Draggable
      nodeRef={nodeRef}
      handle='#draggable-dialog-title'
      cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
      position={disabled ? { x: 0, y: 0 } : position}
      onStart={onStart}
      onDrag={onDrag}
      onStop={onStop}
      disabled={disabled}
    >
      <Paper 
        {...other} 
        ref={nodeRef} 
        style={{ 
          ...other.style,
          position: 'fixed',
          top: 0,
          left: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: disabled ? 0 : '4px', 
          overflow: 'hidden',
          width: disabled ? '100vw' : 'auto',
          height: disabled ? '100vh' : 'auto',
        }} 
      />
    </Draggable>
  )
})

interface IResizableDialogProps {
    id:string
    children: React.ReactNode;
    isMaximized?: boolean;
    onFocus?: () => void;
    onWindowChange?: (id:string, isMaximized:boolean, x:number, y:number, width:number, height:number) => void
    x?: number
    y?: number
    width?: number
    height?: number
}

const ResizableDialog: React.FC<IResizableDialogProps> = ({ id, children, isMaximized = false, onFocus, onWindowChange, x=100, y=50, width=800, height=600 }) => {
    const [isInteracting, setIsInteracting] = useState(false)
    const [layout, setLayout] = useState({ x, y, width, height })
    const paperRef = useRef<HTMLDivElement>(null)
    const theme = useTheme()

    const handleResizeInteractionStart = useCallback(() => {
        setIsInteracting(true)
        if (onFocus) onFocus()
    }, [onFocus])

    const handleResizeInteractionStop = () => {
        setIsInteracting(false);
        if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
    }

    const handleDragInteractionStart = () => {
        setIsInteracting(true)
    }

    const handleDragInteractionStop = () => {
        setIsInteracting(false)
        if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
    }

    const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
        setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
    }, [])

    const handleResize = useCallback((_e: React.SyntheticEvent, { size, handle }: ResizeCallbackData) => {
        setLayout(prev => {
            let newX = prev.x
            if (handle === 'sw') {
                const deltaWidth = size.width - prev.width
                newX = prev.x - deltaWidth
            }
            return { ...prev, width: size.width, height: size.height, x: newX }
        })
    }, [])

    const finalWidth = isMaximized ? window.innerWidth : layout.width
    const finalHeight = isMaximized ? window.innerHeight : layout.height

    return (
        <Dialog
            open={true}
            hideBackdrop
            disableEnforceFocus
            disablePortal
            maxWidth={false}
            onMouseDown={onFocus}
            PaperComponent={PaperComponent as any}
            PaperProps={{
                nodeRef: paperRef,
                position: { x: layout.x, y: layout.y },
                onStart: handleDragInteractionStart,
                onDrag: handleDrag,
                onStop: handleDragInteractionStop,
                disabled: isMaximized,
            } as any}
            sx={{
                pointerEvents: 'none',
                '& .MuiDialog-container': { display: 'block' },
                '& .MuiDialog-paper': {
                    pointerEvents: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    boxSizing: 'border-box',
                    boxShadow: isInteracting ? 24 : 8,
                    transition: isInteracting ? 'none' : 'all 0.2s ease-in-out',
                }
            }}
        >
            <ResizableBox
                width={finalWidth}
                height={finalHeight}
                onResizeStart={handleResizeInteractionStart}
                onResize={handleResize}
                onResizeStop={handleResizeInteractionStop}
                minConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [400, 300]}
                maxConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [Infinity, Infinity]}
                resizeHandles={isMaximized ? [] : ['se', 'sw']}
                handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
            >
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    height: '100%', 
                    width: '100%', 
                    border: theme.palette.mode === 'dark'? '1px solid #333' : '1px solid #ccc', 
                    backgroundColor: theme.palette.background.default,
                    position: 'relative',
                    borderRadius: isMaximized ? 0 : '4px',
                    overflow: 'hidden' 
                }}>
                    {isInteracting ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100]}}>
                            Adjusting window...
                        </Box>
                    ) : children}
                </Box>
            </ResizableBox>
        </Dialog>
    )
}

export { ResizableDialog }
