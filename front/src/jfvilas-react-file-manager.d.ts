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

    export interface IFileData {
        name: string;
        isDirectory: boolean;
        path: string;
        updatedAt?: string;
        size?: number;
        class?: string;
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

    const FileManager : FC<{
        actions: Map<string, IAction[]>,
        files: IFileData[],
        fileUploadConfig,
        icons: Map<string, IIcon[]>,
        isLoading?: boolean,
        onCreateFolder,
        onFileUploading : (file:IFileData, parentFolder: IFileData) => void,
        onFileUploaded? : () => void,
        onCut?,
        onCopy?,
        onPaste,
        onRename,
        onDownload,
        onDelete : (files:IFileData[]) => void,
        onLayoutChange? : () => void,
        onRefresh,
        onFileOpen? : () => void,
        onFolderChange : (folder: string) => void,
        onSelect?,
        onSelectionChange?,
        onError? : (error: IError, file: IFileData) => void,
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
        formatDate?
    }>
   
}