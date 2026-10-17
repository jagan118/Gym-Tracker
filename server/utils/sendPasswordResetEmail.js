const nodemailer = require('nodemailer');

const getSmtpConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(SMTP_PORT);

  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    from: SMTP_FROM,
  };
};

const isSmtpConfigured = () => Boolean(getSmtpConfig());

const sendPasswordResetEmail = async (email, code) => {
  const config = getSmtpConfig();
  if (!config) {
    const error = new Error('Password reset email is not configured. Set the SMTP environment variables.');
    error.statusCode = 503;
    throw error;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.auth.user, pass: config.auth.pass },
    });

    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: 'GymLog password reset code',
      text: `Your GymLog password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your GymLog password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    });
  } catch (cause) {
    const error = new Error('Password reset email could not be sent. Please try again later.');
    error.statusCode = 503;
    error.cause = cause;
    throw error;
  }
};

module.exports = { isSmtpConfigured, sendPasswordResetEmail };
