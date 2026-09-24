import crypto from 'crypto';

const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export default generateResetToken;