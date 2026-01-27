declare module '@jfvilas/react-file-manager' {
    import { FC } from 'react'

    export interface IFileUploadConfig {
        url: string
        method?: "POST" | "PUT"
        headers?: { [key: string]: string }
    }

    export interface IFileDownloadConfig {
        url: string
        headers?: { [key: string]: string }
    }

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
        categories?: string[];
        features?: string[];
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
        sumUnits?: string[],
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

    export interface ICategoryValue {
        key: string,
        text?: string
    }

    export interface ICategory {
        key: string,
        text: string,
        all: ICategoryValue[],
        selected: string[],
        onCategoryValuesChange: (categoryKey:string, value:string, selected:string[]) => void
        onCategoryFilter: (categoryKey:string, f:IFileObject) => boolean
        isFilterActive: (categoryKey:string) => boolean
    }

    export interface IPermissions {
        create: boolean,
        delete: boolean,
        download: boolean,
        copy: boolean,
        move: boolean,
        rename: boolean,
        upload: boolean
    }

    const FileManager : FC<{
        actions?: Map<string, IAction[]>,
        space?: string
        spaces?: Map<string, ISpace>,
        files?: IFileObject[],
        fileUploadConfig?: IFileUploadConfig,
        fileDownloadConfig?: IFileDownloadConfig,
        icons?: Map<string, IIcon[]>,
        isLoading?: boolean,
        onCreateFolder? : (name: string, parentFolder: IFileObject) => void,
        onFileUploading? : (file:IFileObject, parentFolder: IFileObject) => void,
        onFileUploaded? : () => void,
        onCut? : (files: IFileObject[]) => void,
        onCopy? : (files: IFileObject[]) => void,
        onPaste? : (files: IFileObject[], destFolder:IFileObject, operation:string) => void,
        onRename? : (file: IFileObject, newName: string) => void,
        onDownload? : (files: IFileObject[]) => void,
        onDelete? : (files:IFileObject[]) => void,
        onLayoutChange? : () => void,
        onRefresh? : () => void,
        onFileOpen? : () => void,
        onFolderChange : (folder: string) => void,
        onSelect? : (files:IFileObject[]) => void,
        onSelectionChange? : (files:IFileObject[]) => void,
        onError? : (error: IError, file: IFileObject) => void,
        layout?: string,
        enableFilePreview : boolean,
        maxFileSize? : number,
        filePreviewPath : string,
        acceptedFileTypes? : string[],
        height : string,
        width? : string,
        initialPath : string,
        filePreviewComponent? : React.ReactNode,
        primaryColor : string,
        fontFamily : string,
        language? : string,
        permissions : IPermissions,
        collapsibleNav? : boolean,
        defaultNavExpanded? : boolean,
        className? : string,
        style? : any,
        searchMode?: 'auto'|'hidden'|'visible',
        searchRegex?: boolean,
        searchCasing?: boolean,
        showRefresh?: boolean,
        showContextMenu?: boolean,
        showBreadcrumb?: boolean,
        categories?: ICategory[],
        formatDate? : string | number
    }>  
  
}