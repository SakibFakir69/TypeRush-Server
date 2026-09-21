
import { Resend } from 'resend';

const apiKey = process.env.RESEND_EMAIL_API_KEY;
if (!apiKey) {
  throw new Error('Please provide RESEND_EMAIL_API_KEY');
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const resend = new Resend(apiKey);

