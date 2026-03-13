// MIXED (Gemini-Julio)
import React, { useState, useCallback, useRef } from 'react'
import { Dialog, Paper, Box, useTheme } from '@mui/material'
import Draggable, { DraggableData } from 'react-draggable'
import { ResizableBox, ResizeCallbackData } from 'react-resizable'

const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    const { handleAxis, ...restProps } = props
    const isSE = handleAxis === 'se'
    const style: React.CSSProperties = {
        position: 'absolute', bottom: 3, [isSE ? 'right' : 'left']: 3,
        width: '12px', height: '12px', zIndex: 20, cursor: isSE ? 'nwse-resize' : 'sw-resize',
        borderRight: isSE ? '3px solid #bdbdbd' : 'none', borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
        borderBottom: '3px solid #bdbdbd', borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
    }
    return <div ref={ref} style={style} {...restProps} />
})

const PaperComponent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
    return (
        <Draggable
            nodeRef={nodeRef} handle='#draggable-dialog-title'
            cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
            position={disabled ? { x: 0, y: 0 } : position}
            onStart={onStart} onDrag={onDrag} onStop={onStop} disabled={disabled}
        >
            <Paper {...other} ref={nodeRef} style={{ ...other.style, position: 'fixed', top: 0, left: 0, margin: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} />
        </Draggable>
    )
})

interface IResizableDialogProps {
    id: string; children: React.ReactNode; isMaximized?: boolean; onFocus?: () => void;
    onWindowChange?: (id: string, isMaximized: boolean, x: number, y: number, width: number, height: number) => void
    x?: number; y?: number; width?: number; height?: number
}

const ResizableDialog: React.FC<IResizableDialogProps> = ({ id, children, isMaximized = false, onFocus, onWindowChange, x = 100, y = 50, width = 800, height = 600 }) => {
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [layout, setLayout] = useState({ x, y, width, height })
    
    const contentRef = useRef<HTMLDivElement>(null)
    const snapshotRef = useRef<HTMLDivElement>(null)
    const paperRef = useRef<HTMLDivElement>(null)
    const theme = useTheme()

    // Crea un clon estático del contenido para el Drag
    const createSnapshot = () => {
        if (contentRef.current && snapshotRef.current) {
            snapshotRef.current.innerHTML = contentRef.current.innerHTML
        }
    }

    const handleDragStart = () => {
        createSnapshot()
        setIsDragging(true)
        onFocus?.()
    }

    const handleDragStop = () => {
        setIsDragging(false)
        onWindowChange?.(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
    }

    const handleResizeStart = () => { setIsResizing(true); onFocus?.(); }
    const handleResizeStop = () => {
        setIsResizing(false)
        onWindowChange?.(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
    }

    const handleDrag = useCallback((_e: any, data: DraggableData) => {
        setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
    }, [])

    const handleResize = useCallback((_e: any, { size, handle }: ResizeCallbackData) => {
        setLayout(prev => {
            let newX = prev.x
            if (handle === 'sw') newX = prev.x - (size.width - prev.width)
            return { ...prev, width: size.width, height: size.height, x: newX }
        })
    }, [])

    return (
        <Dialog
            open={true} hideBackdrop disableEnforceFocus disablePortal maxWidth={false}
            onMouseDown={onFocus} PaperComponent={PaperComponent as any}
            PaperProps={{ nodeRef: paperRef, position: { x: layout.x, y: layout.y }, onStart: handleDragStart, onDrag: handleDrag, onStop: handleDragStop, disabled: isMaximized }}
            sx={{
                pointerEvents: 'none',
                '& .MuiDialog-container': { display: 'block' },
                '& .MuiDialog-paper': { 
                    pointerEvents: 'auto', maxWidth: 'none', maxHeight: 'none', 
                    transition: (isDragging || isResizing) ? 'none' : 'all 0.2s ease-in-out' 
                }
            }}
        >
            <ResizableBox
                width={isMaximized ? window.innerWidth : layout.width}
                height={isMaximized ? window.innerHeight : layout.height}
                onResizeStart={handleResizeStart} onResize={handleResize} onResizeStop={handleResizeStop}
                resizeHandles={isMaximized ? [] : ['se', 'sw']}
                handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
            >
                <Box sx={{ 
                    display: 'flex', flexDirection: 'column', height: '100%', width: '100%', 
                    position: 'relative', overflow: 'hidden', bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`
                }}>
                    {/* 1. MODO RESIZE: No renderizamos nada (máximo rendimiento) */}
                    {isResizing && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                            Resizing...
                        </Box>
                    )}

                    {/* 2. MODO DRAG: Mostramos el clon estático blurreado */}
                    <Box 
                        ref={snapshotRef}
                        sx={{ 
                            display: isDragging ? 'block' : 'none',
                            width: '100%', height: '100%', 
                            filter: 'blur(3px)', opacity: 0.8,
                            pointerEvents: 'none', transform: 'translateZ(0)' 
                        }} 
                    />

                    {/* 3. MODO NORMAL: El contenido vivo */}
                    <Box ref={contentRef} sx={{ display: (isDragging || isResizing) ? 'none' : 'block', width: '100%', height: '100%' }}>
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
                            {children}
                        </Box>
                    </Box>
                </Box>
            </ResizableBox>
        </Dialog>
    )
}

export { ResizableDialog }









// ULTIMO DE GEMINI
// import React, { useState, useCallback, useRef } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
//     const style: React.CSSProperties = {
//         position: 'absolute', bottom: 3, [isSE ? 'right' : 'left']: 3,
//         width: '12px', height: '12px', zIndex: 20, cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none', borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd', borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }
//     return <div ref={ref} style={style} {...restProps} />
// })

// const PaperComponent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
//     return (
//         <Draggable
//             nodeRef={nodeRef} handle='#draggable-dialog-title'
//             cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//             position={disabled ? { x: 0, y: 0 } : position}
//             onStart={onStart} onDrag={onDrag} onStop={onStop} disabled={disabled}
//         >
//             <Paper {...other} ref={nodeRef} style={{ ...other.style, position: 'fixed', top: 0, left: 0, margin: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} />
//         </Draggable>
//     )
// })

// interface IResizableDialogProps {
//     id: string; children: React.ReactNode; isMaximized?: boolean; onFocus?: () => void;
//     onWindowChange?: (id: string, isMaximized: boolean, x: number, y: number, width: number, height: number) => void
//     x?: number; y?: number; width?: number; height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ id, children, isMaximized = false, onFocus, onWindowChange, x = 100, y = 50, width = 800, height = 600 }) => {
//     const [isDragging, setIsDragging] = useState(false)
//     const [isResizing, setIsResizing] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
    
//     const contentRef = useRef<HTMLDivElement>(null)
//     const snapshotRef = useRef<HTMLDivElement>(null)
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     // Crea un clon estático del contenido para el Drag
//     const createSnapshot = () => {
//         if (contentRef.current && snapshotRef.current) {
//             snapshotRef.current.innerHTML = contentRef.current.innerHTML
//         }
//     }

//     const handleDragStart = () => {
//         createSnapshot()
//         setIsDragging(true)
//         onFocus?.()
//     }

//     const handleDragStop = () => {
//         setIsDragging(false)
//         onWindowChange?.(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleResizeStart = () => { setIsResizing(true); onFocus?.(); }
//     const handleResizeStop = () => {
//         setIsResizing(false)
//         onWindowChange?.(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDrag = useCallback((_e: any, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     const handleResize = useCallback((_e: any, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') newX = prev.x - (size.width - prev.width)
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     return (
//         <Dialog
//             open={true} hideBackdrop disableEnforceFocus disablePortal maxWidth={false}
//             onMouseDown={onFocus} PaperComponent={PaperComponent as any}
//             PaperProps={{ nodeRef: paperRef, position: { x: layout.x, y: layout.y }, onStart: handleDragStart, onDrag: handleDrag, onStop: handleDragStop, disabled: isMaximized }}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': { 
//                     pointerEvents: 'auto', maxWidth: 'none', maxHeight: 'none', 
//                     transition: (isDragging || isResizing) ? 'none' : 'all 0.2s ease-in-out' 
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={isMaximized ? window.innerWidth : layout.width}
//                 height={isMaximized ? window.innerHeight : layout.height}
//                 onResizeStart={handleResizeStart} onResize={handleResize} onResizeStop={handleResizeStop}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', flexDirection: 'column', height: '100%', width: '100%', 
//                     position: 'relative', overflow: 'hidden', bgcolor: 'background.paper',
//                     border: `1px solid ${theme.palette.divider}`
//                 }}>
//                     {/* 1. MODO RESIZE: No renderizamos nada (máximo rendimiento) */}
//                     {isResizing && (
//                         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
//                             Resizing...
//                         </Box>
//                     )}

//                     {/* 2. MODO DRAG: Mostramos el clon estático blurreado */}
//                     <Box 
//                         ref={snapshotRef}
//                         sx={{ 
//                             display: isDragging ? 'block' : 'none',
//                             width: '100%', height: '100%', 
//                             filter: 'blur(3px)', opacity: 0.8,
//                             pointerEvents: 'none', transform: 'translateZ(0)' 
//                         }} 
//                     />

//                     {/* 3. MODO NORMAL: El contenido vivo */}
//                     <Box 
//                         ref={contentRef}
//                         sx={{ 
//                             display: (isDragging || isResizing) ? 'none' : 'block',
//                             width: '100%', height: '100%' 
//                         }}
//                     >
//                         {children}
//                     </Box>
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }
















// BLUR convista del fondo y diferenciando resize de drag

// import React, { useState, useCallback, useRef } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme, Typography } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
    
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         bottom: 3,
//         [isSE ? 'right' : 'left']: 3,
//         width: '12px',
//         height: '12px',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none',
//         borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd',
//         cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         zIndex: 20,
//         borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }
//     return <div ref={ref} style={style} {...restProps} />
// })

// const PaperComponent = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
//     return (
//         <Draggable
//             nodeRef={nodeRef}
//             handle='#draggable-dialog-title'
//             cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//             position={disabled ? { x: 0, y: 0 } : position}
//             onStart={onStart}
//             onDrag={onDrag}
//             onStop={onStop}
//             disabled={disabled}
//         >
//             <Paper 
//                 {...other} 
//                 ref={nodeRef} 
//                 style={{ 
//                     ...other.style,
//                     position: 'fixed',
//                     top: 0, left: 0, margin: 0,
//                     display: 'flex', flexDirection: 'column',
//                     borderRadius: disabled ? 0 : '4px', 
//                     overflow: 'hidden',
//                     width: disabled ? '100vw' : 'auto',
//                     height: disabled ? '100vh' : 'auto',
//                 }} 
//             />
//         </Draggable>
//     )
// })

// interface IResizableDialogProps {
//     id: string; children: React.ReactNode; isMaximized?: boolean; onFocus?: () => void;
//     onWindowChange?: (id: string, isMaximized: boolean, x: number, y: number, width: number, height: number) => void
//     x?: number; y?: number; width?: number; height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ 
//     id, children, isMaximized = false, onFocus, onWindowChange, x = 100, y = 50, width = 800, height = 600 
// }) => {
//     const [isDragging, setIsDragging] = useState(false)
//     const [isResizing, setIsResizing] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     const handleDragStart = () => { setIsDragging(true); if (onFocus) onFocus(); }
//     const handleDragStop = () => {
//         setIsDragging(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleResizeStart = () => { setIsResizing(true); if (onFocus) onFocus(); }
//     const handleResizeStop = () => {
//         setIsResizing(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDrag = useCallback((_e: any, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     const handleResize = useCallback((_e: any, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') newX = prev.x - (size.width - prev.width)
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     const isInteracting = isDragging || isResizing

//     return (
//         <Dialog
//             open={true} hideBackdrop disableEnforceFocus disablePortal maxWidth={false}
//             onMouseDown={onFocus}
//             PaperComponent={PaperComponent as any}
//             PaperProps={{
//                 nodeRef: paperRef,
//                 position: { x: layout.x, y: layout.y },
//                 onStart: handleDragStart,
//                 onDrag: handleDrag,
//                 onStop: handleDragStop,
//                 disabled: isMaximized,
//             } as any}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': {
//                     pointerEvents: 'auto', maxWidth: 'none', maxHeight: 'none',
//                     boxSizing: 'border-box',
//                     boxShadow: isInteracting ? 24 : 8,
//                     // Muy importante: Si estamos moviendo, quitamos el color sólido para que el blur funcione contra el fondo
//                     backgroundColor: isInteracting ? 'transparent !important' : 'background.paper',
//                     backgroundImage: isInteracting ? 'none' : undefined,
//                     transition: isInteracting ? 'none' : 'all 0.2s ease-in-out',
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={isMaximized ? window.innerWidth : layout.width}
//                 height={isMaximized ? window.innerHeight : layout.height}
//                 onResizeStart={handleResizeStart}
//                 onResize={handleResize}
//                 onResizeStop={handleResizeStop}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', flexDirection: 'column', height: '100%', width: '100%', 
//                     position: 'relative', overflow: 'hidden',
//                     borderRadius: isMaximized ? 0 : '4px',
//                     border: `1px solid ${theme.palette.divider}`,
//                     // Estilo Glassmorphism mientras arrastras/redimensionas
//                     backgroundColor: isInteracting 
//                         ? (theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.4)' : 'rgba(255, 255, 255, 0.4)')
//                         : theme.palette.background.default,
//                     backdropFilter: isInteracting ? 'blur(12px)' : 'none',
//                     WebkitBackdropFilter: isInteracting ? 'blur(12px)' : 'none',
//                 }}>
//                     {isInteracting ? (
//                         // MODO INTERACCIÓN: Desmontamos el contenido pesado (Recharts no se ejecuta)
//                         <Box sx={{ 
//                             display: 'flex', alignItems: 'center', justifyContent: 'center', 
//                             height: '100%', width: '100%' 
//                         }}>
//                             <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
//                                 {isDragging ? 'Moving...' : 'Resizing...'}
//                             </Typography>
//                         </Box>
//                     ) : (
//                         // MODO NORMAL: Se renderiza todo
//                         <Box sx={{ width: '100%', height: '100%', flexGrow: 1 }}>
//                             {children}
//                         </Box>
//                     )}
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }

// BLUR con render y RESIZE sin contenido
// import React, { useState, useCallback, useRef } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme, Typography } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
    
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         bottom: 3,
//         [isSE ? 'right' : 'left']: 3,
//         width: '12px',
//         height: '12px',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none',
//         borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd',
//         cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         zIndex: 20,
//         borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }

//     return <div ref={ref} style={style} {...restProps} />
// })

// interface DraggablePaperProps extends Omit<PaperProps, 'onDrag'> {
//   nodeRef: React.RefObject<HTMLDivElement>
//   position: { x: number; y: number }
//   onDrag: (e: DraggableEvent, data: DraggableData) => void
//   onStart: (e: DraggableEvent, data: DraggableData) => void
//   onStop: (e: DraggableEvent, data: DraggableData) => void
//   disabled?: boolean
// }

// const PaperComponent = React.forwardRef<HTMLDivElement, DraggablePaperProps>((props, ref) => {
//   const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
  
//   return (
//     <Draggable
//       nodeRef={nodeRef}
//       handle='#draggable-dialog-title'
//       cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//       position={disabled ? { x: 0, y: 0 } : position}
//       onStart={onStart}
//       onDrag={onDrag}
//       onStop={onStop}
//       disabled={disabled}
//     >
//       <Paper 
//         {...other} 
//         ref={nodeRef} 
//         style={{ 
//           ...other.style,
//           position: 'fixed',
//           top: 0,
//           left: 0,
//           margin: 0,
//           display: 'flex',
//           flexDirection: 'column',
//           borderRadius: disabled ? 0 : '4px', 
//           overflow: 'hidden',
//           width: disabled ? '100vw' : 'auto',
//           height: disabled ? '100vh' : 'auto',
//         }} 
//       />
//     </Draggable>
//   )
// })

// interface IResizableDialogProps {
//     id: string
//     children: React.ReactNode;
//     isMaximized?: boolean;
//     onFocus?: () => void;
//     onWindowChange?: (id: string, isMaximized: boolean, x: number, y: number, width: number, height: number) => void
//     x?: number
//     y?: number
//     width?: number
//     height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ 
//     id, children, isMaximized = false, onFocus, onWindowChange, x = 100, y = 50, width = 800, height = 600 
// }) => {
//     const [isDragging, setIsDragging] = useState(false)
//     const [isResizing, setIsResizing] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     // --- Handlers de Drag ---
//     const handleDragStart = () => {
//         setIsDragging(true)
//         if (onFocus) onFocus()
//     }

//     const handleDragStop = () => {
//         setIsDragging(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     // --- Handlers de Resize ---
//     const handleResizeStart = () => {
//         setIsResizing(true)
//         if (onFocus) onFocus()
//     }

//     const handleResizeStop = () => {
//         setIsResizing(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleResize = useCallback((_e: React.SyntheticEvent, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') {
//                 const deltaWidth = size.width - prev.width
//                 newX = prev.x - deltaWidth
//             }
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     const finalWidth = isMaximized ? window.innerWidth : layout.width
//     const finalHeight = isMaximized ? window.innerHeight : layout.height
//     const isInteracting = isDragging || isResizing

//     return (
//         <Dialog
//             open={true}
//             hideBackdrop
//             disableEnforceFocus
//             disablePortal
//             maxWidth={false}
//             onMouseDown={onFocus}
//             PaperComponent={PaperComponent as any}
//             PaperProps={{
//                 nodeRef: paperRef,
//                 position: { x: layout.x, y: layout.y },
//                 onStart: handleDragStart,
//                 onDrag: handleDrag,
//                 onStop: handleDragStop,
//                 disabled: isMaximized,
//             } as any}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': {
//                     pointerEvents: 'auto',
//                     maxWidth: 'none',
//                     maxHeight: 'none',
//                     boxSizing: 'border-box',
//                     boxShadow: isInteracting ? 24 : 8,
//                     transition: isInteracting ? 'none' : 'all 0.2s ease-in-out',
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={finalWidth}
//                 height={finalHeight}
//                 onResizeStart={handleResizeStart}
//                 onResize={handleResize}
//                 onResizeStop={handleResizeStop}
//                 minConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [400, 300]}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', 
//                     flexDirection: 'column', 
//                     height: '100%', 
//                     width: '100%', 
//                     border: theme.palette.mode === 'dark' ? '1px solid #444' : '1px solid #ccc', 
//                     backgroundColor: theme.palette.background.default,
//                     position: 'relative',
//                     borderRadius: isMaximized ? 0 : '4px',
//                     overflow: 'hidden' 
//                 }}>
//                     {isResizing ? (
//                         // CASO RESIZE: No renderizamos el contenido para máxima fluidez
//                         <Box sx={{ 
//                             display: 'flex', 
//                             alignItems: 'center', 
//                             justifyContent: 'center', 
//                             height: '100%', 
//                             bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)'
//                         }}>
//                             <Typography sx={{ color: '#999', fontWeight: 500 }}>
//                                 Resizing...
//                             </Typography>
//                         </Box>
//                     ) : (
//                         // CASO NORMAL O DRAG: El contenido se queda en el DOM
//                         <Box sx={{ 
//                             width: '100%', 
//                             height: '100%',
//                             flexGrow: 1,
//                             // Si es DRAG, aplicamos el blur y bloqueamos clicks
//                             filter: isDragging ? 'blur(4px)' : 'none',
//                             pointerEvents: isDragging ? 'none' : 'auto',
//                             opacity: isDragging ? 0.7 : 1,
//                             transition: 'filter 0.2s ease',
//                             willChange: 'filter'
//                         }}>
//                             {children}
//                         </Box>
//                     )}
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }


// BLUR DEL CNTENIDO (completo)
// import React, { useState, useCallback, useRef, useMemo } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
    
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         bottom: 3,
//         [isSE ? 'right' : 'left']: 3,
//         width: '12px',
//         height: '12px',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none',
//         borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd',
//         cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         zIndex: 20,
//         borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }

//     return <div ref={ref} style={style} {...restProps} />
// })

// interface DraggablePaperProps extends Omit<PaperProps, 'onDrag'> {
//   nodeRef: React.RefObject<HTMLDivElement>
//   position: { x: number; y: number }
//   onDrag: (e: DraggableEvent, data: DraggableData) => void
//   onStart: (e: DraggableEvent, data: DraggableData) => void
//   onStop: (e: DraggableEvent, data: DraggableData) => void
//   disabled?: boolean
// }

// const PaperComponent = React.forwardRef<HTMLDivElement, DraggablePaperProps>((props, ref) => {
//   const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
  
//   return (
//     <Draggable
//       nodeRef={nodeRef}
//       handle='#draggable-dialog-title'
//       cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//       position={disabled ? { x: 0, y: 0 } : position}
//       onStart={onStart}
//       onDrag={onDrag}
//       onStop={onStop}
//       disabled={disabled}
//     >
//       <Paper 
//         {...other} 
//         ref={nodeRef} 
//         style={{ 
//           ...other.style,
//           position: 'fixed',
//           top: 0,
//           left: 0,
//           margin: 0,
//           display: 'flex',
//           flexDirection: 'column',
//           borderRadius: disabled ? 0 : '4px', 
//           overflow: 'hidden',
//           width: disabled ? '100vw' : 'auto',
//           height: disabled ? '100vh' : 'auto',
//         }} 
//       />
//     </Draggable>
//   )
// })

// interface IResizableDialogProps {
//     id: string
//     children: React.ReactNode;
//     isMaximized?: boolean;
//     onFocus?: () => void;
//     onWindowChange?: (id: string, isMaximized: boolean, x: number, y: number, width: number, height: number) => void
//     x?: number
//     y?: number
//     width?: number
//     height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ 
//     id, 
//     children, 
//     isMaximized = false, 
//     onFocus, 
//     onWindowChange, 
//     x = 100, 
//     y = 50, 
//     width = 800, 
//     height = 600 
// }) => {
//     const [isInteracting, setIsInteracting] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     // --- Handlers de Interacción ---
//     const handleStart = () => {
//         setIsInteracting(true)
//         if (onFocus) onFocus()
//     }

//     const handleStop = () => {
//         setIsInteracting(false)
//         if (onWindowChange) {
//             onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//         }
//     }

//     const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     const handleResize = useCallback((_e: React.SyntheticEvent, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') {
//                 const deltaWidth = size.width - prev.width
//                 newX = prev.x - deltaWidth
//             }
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     const finalWidth = isMaximized ? window.innerWidth : layout.width
//     const finalHeight = isMaximized ? window.innerHeight : layout.height

//     return (
//         <Dialog
//             open={true}
//             hideBackdrop
//             disableEnforceFocus
//             disablePortal
//             maxWidth={false}
//             onMouseDown={onFocus}
//             PaperComponent={PaperComponent as any}
//             PaperProps={{
//                 nodeRef: paperRef,
//                 position: { x: layout.x, y: layout.y },
//                 onStart: handleStart,
//                 onDrag: handleDrag,
//                 onStop: handleStop,
//                 disabled: isMaximized,
//             } as any}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': {
//                     pointerEvents: 'auto',
//                     maxWidth: 'none',
//                     maxHeight: 'none',
//                     boxSizing: 'border-box',
//                     boxShadow: isInteracting ? 24 : 8,
//                     transition: isInteracting ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={finalWidth}
//                 height={finalHeight}
//                 onResizeStart={handleStart}
//                 onResize={handleResize}
//                 onResizeStop={handleStop}
//                 minConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [400, 300]}
//                 maxConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [Infinity, Infinity]}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', 
//                     flexDirection: 'column', 
//                     height: '100%', 
//                     width: '100%', 
//                     border: theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid #ccc', 
//                     backgroundColor: theme.palette.background.default,
//                     position: 'relative',
//                     borderRadius: isMaximized ? 0 : '4px',
//                     overflow: 'hidden' 
//                 }}>
//                     {/* Contenedor de Contenido: 
//                         No se desmonta, solo se desenfoca y bloquea interacciones 
//                     */}
//                     <Box sx={{ 
//                         width: '100%', 
//                         height: '100%',
//                         flexGrow: 1,
//                         // El efecto visual clave:
//                         filter: isInteracting ? 'blur(10px) grayscale(0.2)' : 'none',
//                         opacity: isInteracting ? 0.7 : 1,
//                         // Evita que el navegador registre clicks o scrolls internos mientras se mueve
//                         pointerEvents: isInteracting ? 'none' : 'auto',
//                         transition: 'filter 0.2s ease, opacity 0.2s ease',
//                         willChange: 'filter, transform'
//                     }}>
//                         {children}
//                     </Box>

//                     {/* Overlay opcional para mostrar un texto o simplemente oscurecer ligeramente */}
//                     {isInteracting && (
//                         <Box sx={{
//                             position: 'absolute',
//                             top: 0, left: 0, right: 0, bottom: 0,
//                             zIndex: 10,
//                             display: 'flex',
//                             alignItems: 'center',
//                             justifyContent: 'center',
//                             backgroundColor: 'rgba(255, 255, 255, 0.01)', // Casi invisible pero bloquea eventos
//                         }} />
//                     )}
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }





// BLUR DEL FONDO DE LA PANTALLA
// import React, { useState, useCallback, useRef } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
    
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         bottom: 3,
//         [isSE ? 'right' : 'left']: 3,
//         width: '12px',
//         height: '12px',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none',
//         borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd',
//         cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         zIndex: 20,
//         borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }

//     return <div ref={ref} style={style} {...restProps} />
// })

// interface DraggablePaperProps extends Omit<PaperProps, 'onDrag'> {
//   nodeRef: React.RefObject<HTMLDivElement>
//   position: { x: number; y: number }
//   onDrag: (e: DraggableEvent, data: DraggableData) => void
//   onStart: (e: DraggableEvent, data: DraggableData) => void
//   onStop: (e: DraggableEvent, data: DraggableData) => void
//   disabled?: boolean
//   isInteracting?: boolean // Nueva prop para controlar estilo
// }

// const PaperComponent = React.forwardRef<HTMLDivElement, DraggablePaperProps>((props, ref) => {
//   const { nodeRef, position, onDrag, onStart, onStop, disabled, isInteracting, ...other } = props
  
//   return (
//     <Draggable
//       nodeRef={nodeRef}
//       handle='#draggable-dialog-title'
//       cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//       position={disabled ? { x: 0, y: 0 } : position}
//       onStart={onStart}
//       onDrag={onDrag}
//       onStop={onStop}
//       disabled={disabled}
//     >
//       <Paper 
//         {...other} 
//         ref={nodeRef} 
//         style={{ 
//           ...other.style,
//           position: 'fixed',
//           top: 0,
//           left: 0,
//           margin: 0,
//           display: 'flex',
//           flexDirection: 'column',
//           borderRadius: disabled ? 0 : '4px', 
//           overflow: 'hidden',
//           width: disabled ? '100vw' : 'auto',
//           height: disabled ? '100vh' : 'auto',
//           // Ajuste crítico: transparencia durante la interacción
//           backgroundColor: isInteracting ? 'transparent' : undefined,
//           backgroundImage: isInteracting ? 'none' : undefined,
//           boxShadow: isInteracting ? 'none' : undefined,
//         }} 
//       />
//     </Draggable>
//   )
// })

// interface IResizableDialogProps {
//     id:string
//     children: React.ReactNode;
//     isMaximized?: boolean;
//     onFocus?: () => void;
//     onWindowChange?: (id:string, isMaximized:boolean, x:number, y:number, width:number, height:number) => void
//     x?: number
//     y?: number
//     width?: number
//     height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ id, children, isMaximized = false, onFocus, onWindowChange, x=100, y=50, width=800, height=600 }) => {
//     const [isInteracting, setIsInteracting] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     const handleResizeInteractionStart = useCallback(() => {
//         setIsInteracting(true)
//         if (onFocus) onFocus()
//     }, [onFocus])

//     const handleResizeInteractionStop = () => {
//         setIsInteracting(false);
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDragInteractionStart = () => {
//         setIsInteracting(true)
//     }

//     const handleDragInteractionStop = () => {
//         setIsInteracting(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     const handleResize = useCallback((_e: React.SyntheticEvent, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') {
//                 const deltaWidth = size.width - prev.width
//                 newX = prev.x - deltaWidth
//             }
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     const finalWidth = isMaximized ? window.innerWidth : layout.width
//     const finalHeight = isMaximized ? window.innerHeight : layout.height

//     return (
//         <Dialog
//             open={true}
//             hideBackdrop
//             disableEnforceFocus
//             disablePortal
//             maxWidth={false}
//             onMouseDown={onFocus}
//             PaperComponent={PaperComponent as any}
//             PaperProps={{
//                 nodeRef: paperRef,
//                 position: { x: layout.x, y: layout.y },
//                 onStart: handleDragInteractionStart,
//                 onDrag: handleDrag,
//                 onStop: handleDragInteractionStop,
//                 disabled: isMaximized,
//                 isInteracting: isInteracting, // Pasamos el estado al Paper
//             } as any}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': {
//                     pointerEvents: 'auto',
//                     maxWidth: 'none',
//                     maxHeight: 'none',
//                     boxSizing: 'border-box',
//                     backgroundColor: isInteracting ? 'transparent !important' : 'background.paper',
//                     backgroundImage: 'none', // Importante en modo oscuro
//                     boxShadow: isInteracting ? 'none' : 8,
//                     transition: isInteracting ? 'none' : 'all 0.2s ease-in-out',
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={finalWidth}
//                 height={finalHeight}
//                 onResizeStart={handleResizeInteractionStart}
//                 onResize={handleResize}
//                 onResizeStop={handleResizeInteractionStop}
//                 minConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [400, 300]}
//                 maxConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [Infinity, Infinity]}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', 
//                     flexDirection: 'column', 
//                     height: '100%', 
//                     width: '100%', 
//                     border: isInteracting 
//                         ? '2px dashed rgba(150,150,150,0.5)' 
//                         : (theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid #ccc'), 
//                     backgroundColor: isInteracting 
//                         ? 'rgba(255, 255, 255, 0.05)' // Fondo casi invisible
//                         : theme.palette.background.default,
//                     backdropFilter: isInteracting ? 'blur(10px)' : 'none',
//                     WebkitBackdropFilter: isInteracting ? 'blur(10px)' : 'none',
//                     position: 'relative',
//                     borderRadius: isMaximized ? 0 : '4px',
//                     overflow: 'hidden' 
//                 }}>
//                     {isInteracting ? (
//                         <Box sx={{ 
//                             display: 'flex', 
//                             alignItems: 'center', 
//                             justifyContent: 'center', 
//                             height: '100%', 
//                             color: theme.palette.text.secondary,
//                             fontSize: '0.9rem',
//                             fontWeight: 'bold'
//                         }}>
//                             Moviendo ventana...
//                         </Box>
//                     ) : children}
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }




// ORIGINAL
// import React, { useState, useCallback, useRef } from 'react'
// import { Dialog, Paper, PaperProps, Box, useTheme } from '@mui/material'
// import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
// import { ResizableBox, ResizeCallbackData } from 'react-resizable'
// import './ResizableDialog.css'

// const CustomHandle = React.forwardRef<HTMLDivElement, any>((props, ref) => {
//     const { handleAxis, ...restProps } = props
//     const isSE = handleAxis === 'se'
    
//     const style: React.CSSProperties = {
//         position: 'absolute',
//         bottom: 3,
//         [isSE ? 'right' : 'left']: 3,
//         width: '12px',
//         height: '12px',
//         borderRight: isSE ? '3px solid #bdbdbd' : 'none',
//         borderLeft: !isSE ? '3px solid #bdbdbd' : 'none',
//         borderBottom: '3px solid #bdbdbd',
//         cursor: isSE ? 'nwse-resize' : 'sw-resize',
//         zIndex: 20,
//         borderRadius: isSE ? '0 0 4px 0' : '0 0 0 4px',
//     }

//     return <div ref={ref} style={style} {...restProps} />
// })

// interface DraggablePaperProps extends Omit<PaperProps, 'onDrag'> {
//   nodeRef: React.RefObject<HTMLDivElement>
//   position: { x: number; y: number }
//   onDrag: (e: DraggableEvent, data: DraggableData) => void
//   onStart: (e: DraggableEvent, data: DraggableData) => void
//   onStop: (e: DraggableEvent, data: DraggableData) => void
//   disabled?: boolean
// }

// const PaperComponent = React.forwardRef<HTMLDivElement, DraggablePaperProps>((props, ref) => {
//   const { nodeRef, position, onDrag, onStart, onStop, disabled, ...other } = props
  
//   return (
//     <Draggable
//       nodeRef={nodeRef}
//       handle='#draggable-dialog-title'
//       cancel={'[class*="MuiIconButton-root"], [class*="MuiButton-root"], .no-drag'}
//       position={disabled ? { x: 0, y: 0 } : position}
//       onStart={onStart}
//       onDrag={onDrag}
//       onStop={onStop}
//       disabled={disabled}
//     >
//       <Paper 
//         {...other} 
//         ref={nodeRef} 
//         style={{ 
//           ...other.style,
//           position: 'fixed',
//           top: 0,
//           left: 0,
//           margin: 0,
//           display: 'flex',
//           flexDirection: 'column',
//           borderRadius: disabled ? 0 : '4px', 
//           overflow: 'hidden',
//           width: disabled ? '100vw' : 'auto',
//           height: disabled ? '100vh' : 'auto',
//         }} 
//       />
//     </Draggable>
//   )
// })

// interface IResizableDialogProps {
//     id:string
//     children: React.ReactNode;
//     isMaximized?: boolean;
//     onFocus?: () => void;
//     onWindowChange?: (id:string, isMaximized:boolean, x:number, y:number, width:number, height:number) => void
//     x?: number
//     y?: number
//     width?: number
//     height?: number
// }

// const ResizableDialog: React.FC<IResizableDialogProps> = ({ id, children, isMaximized = false, onFocus, onWindowChange, x=100, y=50, width=800, height=600 }) => {
//     const [isInteracting, setIsInteracting] = useState(false)
//     const [layout, setLayout] = useState({ x, y, width, height })
//     const paperRef = useRef<HTMLDivElement>(null)
//     const theme = useTheme()

//     const handleResizeInteractionStart = useCallback(() => {
//         setIsInteracting(true)
//         if (onFocus) onFocus()
//     }, [onFocus])

//     const handleResizeInteractionStop = () => {
//         setIsInteracting(false);
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDragInteractionStart = () => {
//         setIsInteracting(true)
//     }

//     const handleDragInteractionStop = () => {
//         setIsInteracting(false)
//         if (onWindowChange) onWindowChange(id, isMaximized, layout.x, layout.y, layout.width, layout.height)
//     }

//     const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
//         setLayout(prev => ({ ...prev, x: data.x, y: data.y }))
//     }, [])

//     const handleResize = useCallback((_e: React.SyntheticEvent, { size, handle }: ResizeCallbackData) => {
//         setLayout(prev => {
//             let newX = prev.x
//             if (handle === 'sw') {
//                 const deltaWidth = size.width - prev.width
//                 newX = prev.x - deltaWidth
//             }
//             return { ...prev, width: size.width, height: size.height, x: newX }
//         })
//     }, [])

//     const finalWidth = isMaximized ? window.innerWidth : layout.width
//     const finalHeight = isMaximized ? window.innerHeight : layout.height

//     return (
//         <Dialog
//             open={true}
//             hideBackdrop
//             disableEnforceFocus
//             disablePortal
//             maxWidth={false}
//             onMouseDown={onFocus}
//             PaperComponent={PaperComponent as any}
//             PaperProps={{
//                 nodeRef: paperRef,
//                 position: { x: layout.x, y: layout.y },
//                 onStart: handleDragInteractionStart,
//                 onDrag: handleDrag,
//                 onStop: handleDragInteractionStop,
//                 disabled: isMaximized,
//             } as any}
//             sx={{
//                 pointerEvents: 'none',
//                 '& .MuiDialog-container': { display: 'block' },
//                 '& .MuiDialog-paper': {
//                     pointerEvents: 'auto',
//                     maxWidth: 'none',
//                     maxHeight: 'none',
//                     boxSizing: 'border-box',
//                     boxShadow: isInteracting ? 24 : 8,
//                     transition: isInteracting ? 'none' : 'all 0.2s ease-in-out',
//                 }
//             }}
//         >
//             <ResizableBox
//                 width={finalWidth}
//                 height={finalHeight}
//                 onResizeStart={handleResizeInteractionStart}
//                 onResize={handleResize}
//                 onResizeStop={handleResizeInteractionStop}
//                 minConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [400, 300]}
//                 maxConstraints={isMaximized ? [window.innerWidth, window.innerHeight] : [Infinity, Infinity]}
//                 resizeHandles={isMaximized ? [] : ['se', 'sw']}
//                 handle={(axis, ref) => <CustomHandle handleAxis={axis} ref={ref} />}
//             >
//                 <Box sx={{ 
//                     display: 'flex', 
//                     flexDirection: 'column', 
//                     height: '100%', 
//                     width: '100%', 
//                     border: theme.palette.mode === 'dark'? '1px solid #333' : '1px solid #ccc', 
//                     backgroundColor: theme.palette.background.default,
//                     position: 'relative',
//                     borderRadius: isMaximized ? 0 : '4px',
//                     overflow: 'hidden' 
//                 }}>
//                     {isInteracting ? (
//                         <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100]}}>
//                             Adjusting window...
//                         </Box>
//                     ) : children}
//                 </Box>
//             </ResizableBox>
//         </Dialog>
//     )
// }

// export { ResizableDialog }
