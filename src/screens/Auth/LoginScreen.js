import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPE, RADIUS, SHADOWS, SPACE } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { s, vs, fs, ms } from '../../utils/responsive';

const STEPS = { PHONE: 'phone', OTP: 'otp' };

export default function LoginScreen() {
  const { sendOtp, verifyOtp } = useAuth();
  const { t } = useLanguage();

  const [step,    setStep]    = useState(STEPS.PHONE);
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);
  const otpRef = useRef(null);

  // Focus the OTP input after step changes to OTP
  useEffect(() => {
    if (step === STEPS.OTP) {
      setTimeout(() => otpRef.current?.focus(), 300);
    }
  }, [step]);

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  async function handleSendOtp() {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert(t('login.invalidPhone'), t('login.invalidPhoneMsg'));
      return;
    }
    setLoading(true);
    try {
      const result = await sendOtp(phone);
      setStep(STEPS.OTP);
      // Dev mode: auto-fill OTP when server returns it (MSG91 not configured).
      // Response is wrapped as { success, data: { sessionId, devOtp } }.
      const devOtp = result?.data?.devOtp ?? result?.devOtp;
      if (devOtp) setOtp(devOtp);
    } catch (err) {
      Alert.alert(t('login.error'), err.response?.data?.error?.message || t('login.otpError'));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  // After OTP verification, setUser() fires in AuthContext.
  // RootNavigator handles routing:
  //   - New user (onboardingStep=BASIC) → OnboardingNavigator (name + location + farm + crops)
  //   - Existing user (onboardingStep=COMPLETE) → AppNavigator
  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      Alert.alert(t('login.invalidOtp'), t('login.invalidOtpMsg'));
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      // Navigation handled automatically by RootNavigator in App.js
    } catch (err) {
      Alert.alert(t('login.error'), err.response?.data?.error?.message || t('login.verifyError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={sty.safe}>
      <View style={[sty.gradient, { backgroundColor: COLORS.primary }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={sty.inner}>

          {/* Logo area */}
          <View style={sty.logoArea}>
            <View style={sty.logoCircle}>
              <Ionicons name="leaf" size={ms(38)} color={COLORS.textWhite} />
            </View>
            <Text style={sty.appName}>{t('appName')}</Text>
            <Text style={sty.tagline}>{t('login.tagline')}</Text>
          </View>

          {/* Card */}
          <View style={sty.card}>
            {step === STEPS.PHONE && (
              <>
                <Text style={sty.cardTitle}>{t('login.enterPhone')}</Text>
                <Text style={sty.cardSub}>{t('login.otpWillSend')}</Text>
                <View style={sty.inputRow}>
                  <View style={sty.countryCode}><Text style={sty.countryTxt}>+91</Text></View>
                  <TextInput
                    style={sty.input}
                    placeholder={t('login.phonePlaceholder')}
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                <TouchableOpacity style={sty.btn} onPress={handleSendOtp} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={sty.btnTxt}>{t('login.sendOtp')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {step === STEPS.OTP && (
              <>
                <TouchableOpacity onPress={() => setStep(STEPS.PHONE)} style={sty.backBtn}>
                  <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={sty.cardTitle}>{t('login.enterOtp')}</Text>
                <Text style={sty.cardSub}>{t('login.otpSentTo', { phone })}</Text>
                <TextInput
                  ref={otpRef}
                  style={sty.otpInput}
                  placeholder={t('login.otpPlaceholder')}
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  editable={true}
                  caretHidden={false}
                  selectionColor={COLORS.primary}
                />
                <TouchableOpacity style={sty.btn} onPress={handleVerifyOtp} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={sty.btnTxt}>{t('login.verifyLogin')}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendOtp} style={sty.resendBtn}>
                  <Text style={sty.resendTxt}>{t('login.resendOtp')}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Name step removed — handled by OnboardingNavigator for new users */}
          </View>

          <Text style={sty.footer}>{t('login.termsNote')}</Text>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );

}

const sty = StyleSheet.create({
  safe:    { flex: 1 },
  gradient:{ flex: 1 },
  inner:   { flex: 1, justifyContent: 'center', paddingHorizontal: s(24), paddingVertical: vs(24), backgroundColor: COLORS.pineGreen },

  logoArea:   { alignItems: 'center', marginBottom: vs(34) },
  logoCircle: { width: ms(84), height: ms(84), borderRadius: ms(26), backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center', marginBottom: vs(16), borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  appName:    { fontSize: fs(34), fontWeight: TYPE.weight.black, color: COLORS.textWhite, letterSpacing: -0.7 },
  tagline:    { fontSize: fs(TYPE.size.sm), color: COLORS.greenWash, marginTop: vs(8), textAlign: 'center', lineHeight: fs(19), maxWidth: s(290) },

  card:      { backgroundColor: COLORS.surface, borderRadius: s(28), padding: s(24), borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)', ...SHADOWS.large },
  cardTitle: { fontSize: fs(23), fontWeight: TYPE.weight.black, color: COLORS.textDark, marginBottom: vs(7), letterSpacing: -0.2 },
  cardSub:   { fontSize: fs(TYPE.size.sm), color: COLORS.textMedium, marginBottom: vs(22), lineHeight: fs(20) },

  inputRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), gap: s(10) },
  countryCode: { backgroundColor: COLORS.surfaceRaised, borderRadius: s(16), paddingHorizontal: s(14), paddingVertical: vs(15), borderWidth: 1.5, borderColor: COLORS.border },
  countryTxt:  { fontSize: fs(TYPE.size.base), fontWeight: TYPE.weight.bold, color: COLORS.textDark },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: s(16), paddingHorizontal: s(14), paddingVertical: vs(15),
    fontSize: fs(TYPE.size.base), color: COLORS.textDark, marginBottom: vs(16),
    backgroundColor: COLORS.inputBg,
  },
  otpInput: {
    width: '100%', borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: RADIUS.md, paddingHorizontal: s(14), paddingVertical: vs(16),
    fontSize: fs(24), fontWeight: '700', color: COLORS.nearBlack,
    backgroundColor: COLORS.white, marginBottom: vs(16),
  },

  btn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: vs(16), minHeight: vs(52), justifyContent: 'center', alignItems: 'center', ...SHADOWS.greenGlow },
  btnTxt: { color: COLORS.white, fontSize: fs(TYPE.size.base), fontWeight: TYPE.weight.bold, letterSpacing: 0.1 },
  backBtn:   { marginBottom: vs(12), minWidth: 44, minHeight: 44, justifyContent: 'center' },
  resendBtn: { alignItems: 'center', marginTop: vs(16), minHeight: 44, justifyContent: 'center' },
  resendTxt: { color: COLORS.primary, fontSize: fs(TYPE.size.sm), fontWeight: TYPE.weight.semibold },

  footer: { textAlign: 'center', color: COLORS.mintBorder, fontSize: fs(11), marginTop: vs(24), lineHeight: fs(16) },
});
