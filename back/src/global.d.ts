import * as fileUpload from 'express-fileupload';

declare global {
  namespace Express {
    interface Request {
      files: fileUpload.Files;
    }
  }
}