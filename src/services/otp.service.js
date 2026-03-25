/**
 * OTP Service — send & verify phone OTPs via MSG91.
 * Falls back to console-log in development if MSG91 key is not set.
 */
import bcrypt from 'bcryptjs';
import axios from 'axios';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

/**
 * Send OTP to phone number.
 * Creates an OtpSession in DB (hashed).
 * Returns { sessionId } on success.
 */
export async function sendOtp(phone) {
  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + ENV.OTP_EXPIRE_MINUTES * 60 * 1000);

  // Invalidate any existing un-verified sessions for this phone
  await prisma.otpSession.updateMany({
    where: { phone, verified: false },
    data: { attempts: ENV.OTP_MAX_ATTEMPTS }, // max out so they expire
  });

  const session = await prisma.otpSession.create({
    data: { phone, otp: hashed, expiresAt },
  });

  if (ENV.MSG91_AUTH_KEY) {
    await sendViaMSG91(phone, otp);
  } else {
    // Development: print to console
    console.log(`[OTP DEV] Phone: ${phone} | OTP: ${otp}`);
  }

  return { sessionId: session.id };
}

/**
 * Verify OTP. Returns { success, userId? }.
 * userId is set if this phone already has a registered user.
 */
export async function verifyOtp(phone, otp) {
  const session = await prisma.otpSession.findFirst({
    where: {
      phone,
      verified: false,
      expiresAt: { gt: new Date() },
      attempts: { lt: ENV.OTP_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    return { success: false, reason: 'OTP expired or not found. Please request a new one.' };
  }

  const match = await bcrypt.compare(otp, session.otp);

  if (!match) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, reason: 'Incorrect OTP.' };
  }

  // Mark verified
  await prisma.otpSession.update({
    where: { id: session.id },
    data: { verified: true },
  });

  // Lookup existing user
  const user = await prisma.user.findUnique({ where: { phone } });

  return { success: true, isNewUser: !user, userId: user?.id || null };
}

// ── MSG91 integration ─────────────────────────────────────────────────────────

async function sendViaMSG91(phone, otp) {
  const url = 'https://control.msg91.com/api/v5/otp';
  const params = {
    authkey: ENV.MSG91_AUTH_KEY,
    template_id: ENV.MSG91_TEMPLATE_ID,
    mobile: `91${phone}`,  // India country code
    otp,
    sender: ENV.MSG91_SENDER_ID,
  };

  try {
    const res = await axios.post(url, null, { params });
    if (res.data?.type !== 'success') {
      throw new Error(res.data?.message || 'MSG91 error');
    }
  } catch (err) {
    console.error('[OTP] MSG91 send failed:', err.message);
    throw new Error('Failed to send OTP. Please try again.');
  }
}
