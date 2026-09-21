
import { createHash } from 'crypto';

export const hashOtp = (otp: string) => createHash('sha256').update(otp).digest('hex');