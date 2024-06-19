export class PopupConfig {
    title:string='';
    message:JSX.Element|undefined;
    ok:boolean=false;
    yes:boolean=false;
    yestoall:boolean=false;
    no:boolean=false;
    notoall:boolean=false;
    cancel:boolean=false;
    originOnClose:(a:string)=>void = (a)=>{};
    onClose:(a:string|null)=>void = (a)=>{} ;
}
