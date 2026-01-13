declare module '@jfvilas/react-file-manager' {
    import { FC } from 'react'

    export interface IError {
        type: string,
        message: string,
        response: {
            status: number,
            statusText: string,
            data: any,
        }
    }

    export interface IFileObject {
        name: string;
        isDirectory: boolean;
        path: string;
        layout?: string;
        class?: string;
        children?: string|function;
        data?: any;
    }

    export interface IAction {
        title: string,
        icon: React.JSX,
        onClick: (files : any) => void
    }

    export interface IIcon {
        open: React.JSX
        closed: React.JSX
        grid: React.JSX
        list: React.JSX
        default: React.JSX
    }

    export interface ISpace {
        text?:string,
        source?:string,
        width?:number,
        sumSourceProperty?: string,
        sumReducer?: number,
        sumUnits?: srting[],
        leftItems?: ISpaceMenuItem[]
        properties?: ISpaceProperty[]
    }

    export interface ISpaceMenuItem {
        name?: string,
        icon?: any,
        text: string,
        permission: boolean,
        multi?: boolean,
        onClick?: (paths:string[], currentTraget:Element) => void
    }

    export interface ISpaceProperty {
        name: string,
        text: string,
        source: string|function,
        format: 'string'|'function'|'age'|'number',
        width: number,
        visible: boolean
    }

    const FileManager : FC<{
        actions: Map<string, IAction[]>,
        files: IFileObject[],
        fileUploadConfig?,
        icons: Map<string, IIcon[]>,
        isLoading?: boolean,
        onCreateFolder,
        onFileUploading? : (file:IFileObject, parentFolder: IFileObject) => void,
        onFileUploaded? : () => void,
        onCut?,
        onCopy?,
        onPaste,
        onRename,
        onDownload?,
        onDelete : (files:IFileObject[]) => void,
        onLayoutChange? : () => void,
        onRefresh,
        onFileOpen? : () => void,
        onFolderChange : (folder: string) => void,
        onSelect?,
        onSelectionChange?,
        onError? : (error: IError, file: IFileObject) => void,
        layout?: string,
        enableFilePreview : boolean,
        maxFileSize? : number,
        filePreviewPath,
        acceptedFileTypes?,
        height : string,
        width? : string,
        initialPath : string,
        filePreviewComponent?,
        primaryColor : string,
        fontFamily : string,
        language? : string,
        permissions,
        collapsibleNav? : boolean,
        defaultNavExpanded? : boolean,
        className? : string,
        style?,
        formatDate?,
        search?: string
        searchRegex?:boolean
        searchCasing?:boolean
        spaces?: Map<string, ISpace>
    }>
   
}