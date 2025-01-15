export class PickListConfig {
    title: string='';
    message: string='';
    values: string[]=[];
    originOnClose: (a:string)=>void = (a)=>{};
    onClose: (a:string|null)=>void = (a)=>{} ;
}