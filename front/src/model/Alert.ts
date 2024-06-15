enum AlertTypeEnum {
    timed='timed',
    permanent='permanent',
    blocking='blocking'
  }
  
enum SeverityEnum {
  default='default',
  info='info',
  success='success',
  warning='warning',
  error='error'
}

class Alert {
  public expression:string='';
  public severity:SeverityEnum=SeverityEnum.default;
  public message:string='';
  public type:AlertTypeEnum=AlertTypeEnum.timed;
  public beep:boolean=false;
}

export { AlertTypeEnum, Alert, SeverityEnum };