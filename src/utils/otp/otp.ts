
import { brevo } from '../../config/brevo-email-config.js';
import { OTP_TTL } from '../../const/auth.const.js';

const buildOtpEmailHtml = (otp: string): string => `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#4f46e5; padding:24px; text-align:center;">
              <h1 style="color:#ffffff; margin:0; font-size:20px;">TypeRush</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <h2 style="margin:0 0 12px; color:#111827; font-size:18px;">Password Reset Code</h2>
              <p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 24px;">
                Use the code below to reset your password. It expires in ${OTP_TTL / 60} minutes.
              </p>
              <div style="background:#f4f4f5; border-radius:6px; padding:16px; text-align:center; margin-bottom:24px;">
                <span style="font-size:32px; font-weight:bold; letter-spacing:8px; color:#111827;">${otp}</span>
              </div>
              <p style="color:#9ca3af; font-size:12px; line-height:1.5; margin:0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendOtpEmail = async (email: string, otp: string): Promise<void> => {
  await brevo.transactionalEmails.sendTransacEmail({
    subject: 'Your TypeRush password reset code',
    htmlContent: buildOtpEmailHtml(otp),
    textContent: `Your OTP is ${otp}. It expires in ${OTP_TTL / 60} minutes.`,
    sender: { name: 'TypeRush', email: process.env.MAIL_FROM! },
    to: [{ email }],
  });
};

export default sendOtpEmail;