class Message {
    public timestamp?:Date;
    public cluster?:string='';
    public namespace?:string='';
    public resource?:string='';
    public text:string='';

    constructor (text:string) {
        this.text=text;
    }
}

export { Message };