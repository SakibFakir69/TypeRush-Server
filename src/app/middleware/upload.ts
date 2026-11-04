import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../../config/cloudinary.js';


const storage = new CloudinaryStorage({
    
  cloudinary,
  params: {
    folder: 'uploads',
    allowed_formats: ['jpg', 'png', 'webp'],
  } as never, // type defs lag the API sometimes
});

export const upload = multer({ storage });