import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
  FlatList, Alert, TextInput,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getDoctorById, getDoctorReviews, submitDoctorReview,
  trackCallClick, trackWhatsAppClick,
} from '../../services/doctorApi';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS } from '../../constants/colors';
import AnimatedScreen from '../../components/ui/AnimatedScreen';

// ─────────────────────────────────────────────────────────────────────────────
// Star Rating Picker
// ─────────────────────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={n <= value ? COLORS.gold : COLORS.divider}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Row
// ─────────────────────────────────────────────────────────────────────────────

function ReviewRow({ review, t }) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const ago = (() => {
    const diff = Date.now() - new Date(review.createdAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t('doctor.reviewToday');
    if (days === 1) return t('doctor.reviewDayAgo');
    if (days < 30)  return t('doctor.reviewDaysAgo', { n: days });
    return t('doctor.reviewMonthsAgo', { n: Math.floor(days / 30) });
  })();

  return (
    <View style={R.row}>
      <View style={R.avatar}>
        <Text style={R.avatarText}>{review.farmerName?.[0] || 'श'}</Text>
      </View>
      <View style={R.body}>
        <View style={R.top}>
          <Text style={R.name}>{review.farmerName}</Text>
          <Text style={R.ago}>{ago}</Text>
        </View>
        <Text style={R.stars}>{stars}</Text>
        {review.comment ? <Text style={R.comment}>{review.comment}</Text> : null}
      </View>
    </View>
  );
}

const R = StyleSheet.create({
  row:        { flexDirection: 'row', gap: 10, paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  avatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryPale,
                alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.greenDeep },
  body:       { flex: 1 },
  top:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  name:       { fontSize: 13, fontWeight: '700', color: COLORS.charcoal2 },
  ago:        { fontSize: 11, color: COLORS.textLight },
  stars:      { fontSize: 14, color: COLORS.gold, marginBottom: 3 },
  comment:    { fontSize: 13, color: COLORS.grayMid2, lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorDetail({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { doctorId } = route.params;

  const [doctor, setDoctor]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [reviews, setReviews]       = useState([]);
  const [reviewMeta, setReviewMeta] = useState(null);
  const [loadingRev, setLoadingRev] = useState(false);

  // Review form
  const [showForm, setShowForm]     = useState(false);
  const [myRating, setMyRating]     = useState(0);
  const [myComment, setMyComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDoctor();
    loadReviews();
  }, [doctorId]);

  async function loadDoctor() {
    try {
      const doc = await getDoctorById(doctorId);
      setDoctor(doc);
    } catch (e) {
      console.warn('[DoctorDetail]', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews(p = 1) {
    setLoadingRev(true);
    try {
      const res = await getDoctorReviews(doctorId, { page: p, limit: 10 });
      if (p === 1) {
        setReviews(res.data || []);
      } else {
        setReviews(prev => [...prev, ...(res.data || [])]);
      }
      setReviewMeta(res.meta);
    } catch (e) {
      console.warn('[DoctorDetail reviews]', e.message);
    } finally {
      setLoadingRev(false);
    }
  }

  async function handleSubmitReview() {
    if (myRating === 0) {
      Alert.alert(t('doctor.ratingRequired'), t('doctor.ratingRequiredMsg'));
      return;
    }
    setSubmitting(true);
    try {
      await submitDoctorReview(doctorId, myRating, myComment);
      setShowForm(false);
      setMyRating(0);
      setMyComment('');
      Alert.alert(t('doctor.reviewThanks'), t('doctor.reviewThanksMsg'));
      loadReviews(1);
      loadDoctor(); // refresh avg
    } catch (e) {
      Alert.alert(t('doctor.reviewError'), e.message || t('doctor.reviewErrorMsg'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCall() {
    if (!doctor?.phone) return;
    trackCallClick(doctorId);
    Linking.openURL(`tel:${doctor.phone}`);
  }

  function handleWhatsApp() {
    if (!doctor?.phone) return;
    trackWhatsAppClick(doctorId);
    const msg = encodeURIComponent(t('doctor.whatsappMsg'));
    Linking.openURL(`whatsapp://send?phone=${doctor.phone}&text=${msg}`);
  }

  if (loading) {
    return (
      <View style={[S.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.greenDeep} />
        <Text style={{ color: COLORS.textBody, marginTop: 10 }}>{t('doctor.loading')}</Text>
      </View>
    );
  }

  if (!doctor) {
    return (
      <View style={[S.center, { paddingTop: insets.top }]}>
        <Text style={S.errorText}>{t('doctor.doctorNotFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: COLORS.greenDeep, marginTop: 8 }}>{t('doctor.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
  const available = doctor.availability?.days?.includes(today);
  const name = doctor.fullName?.mr || doctor.fullName?.en || '';
  const quals = Array.isArray(doctor.qualifications)
    ? doctor.qualifications
    : [];
  const location = [doctor.address?.village, doctor.address?.taluka, doctor.address?.district]
    .filter(Boolean).join(', ');

  return (
    <AnimatedScreen style={[S.root, { paddingTop: insets.top }]}>

      {/* Back button */}
      <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.greenDeep} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>

        {/* ── Hero ── */}
        <View style={S.hero}>
          <View style={S.heroAvatar}>
            <Ionicons name="person" size={44} color={COLORS.greenDeep} />
          </View>
          <Text style={S.heroName}>{name}</Text>
          <View style={S.heroRatingRow}>
            <Ionicons name="star" size={16} color={COLORS.gold} />
            <Text style={S.heroRating}>
              {doctor.rating?.average?.toFixed(1) || '—'}
            </Text>
            <Text style={S.heroRatingCount}>
              {t('doctor.farmerRatingsDetail', { count: doctor.rating?.count || 0 })}
            </Text>
          </View>
          <View style={S.heroMeta}>
            {available ? (
              <View style={S.availPill}>
                <View style={S.greenDot} />
                <Text style={S.availPillText}>{t('doctor.todayAvailable')}</Text>
              </View>
            ) : (
              <View style={[S.availPill, { backgroundColor: COLORS.goldPale }]}>
                <Text style={[S.availPillText, { color: COLORS.amberDark2 }]}>{t('doctor.todayClosed')}</Text>
              </View>
            )}
            {location ? (
              <View style={S.locPill}>
                <Ionicons name="location-outline" size={13} color={COLORS.textMedium} />
                <Text style={S.locText}>{location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Qualifications & Experience ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{t('doctor.qualifications')}</Text>
          {quals.map((q, i) => (
            <View key={i} style={S.qualRow}>
              <Ionicons name="ribbon-outline" size={14} color={COLORS.greenDeep} />
              <Text style={S.qualText}>
                {q.degree}
                {q.specialization ? ` (${q.specialization})` : ''} — {q.college}, {q.university}
                {q.yearOfPassing ? ` (${q.yearOfPassing})` : ''}
              </Text>
            </View>
          ))}
          {doctor.experienceYears > 0 && (
            <View style={S.qualRow}>
              <Ionicons name="time-outline" size={14} color={COLORS.greenDeep} />
              <Text style={S.qualText}>{t('doctor.experienceYears', { n: doctor.experienceYears })}</Text>
            </View>
          )}
          {doctor.clinicName ? (
            <View style={S.qualRow}>
              <Ionicons name="business-outline" size={14} color={COLORS.greenDeep} />
              <Text style={S.qualText}>{doctor.clinicName}</Text>
            </View>
          ) : null}
          {doctor.registrationNumber ? (
            <View style={S.qualRow}>
              <Ionicons name="card-outline" size={14} color={COLORS.greenDeep} />
              <Text style={S.qualText}>{t('doctor.regLabel')} {doctor.registrationNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Animals treated ── */}
        {doctor.animalLabels?.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('doctor.animalsSection')}</Text>
            <View style={S.tagWrap}>
              {doctor.animalLabels.map((a, i) => (
                <View key={i} style={S.tag}>
                  <Text style={S.tagText}>{t(`doctor.animals.${(a.key || a.en || '').toLowerCase()}`) || a.mr || a.en}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Services ── */}
        {doctor.serviceLabels?.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('doctor.servicesSection')}</Text>
            <View style={S.serviceGrid}>
              {doctor.serviceLabels.map((sv, i) => (
                <View key={i} style={S.serviceItem}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.greenDeep} />
                  <Text style={S.serviceText}>{(() => { const k = (sv.key || sv.en || '').toLowerCase().replace(/[\s\/-]/g, '_'); const v = t(`doctor.services.${k}`); return (v && !v.startsWith('doctor.services.')) ? v : (sv.mr || sv.en); })()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Availability ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{t('doctor.availabilitySection')}</Text>
          {doctor.availability?.startTime && (
            <Text style={S.availInfo}>
              {doctor.availability.dayLabels?.join(' · ')} · {doctor.availability.startTime} — {doctor.availability.endTime}
            </Text>
          )}
          {doctor.availability?.emergencyAvailable && (
            <View style={S.emergencyBadge}>
              <Ionicons name="flash" size={14} color={COLORS.error} />
              <Text style={S.emergencyText}>{t('doctor.emergency24x7')}</Text>
            </View>
          )}
        </View>

        {/* ── Fees ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{t('doctor.feesSection')}</Text>
          <View style={S.feeRow}>
            {doctor.consultationFee != null && (
              <View style={S.feeCard}>
                <Text style={S.feeLabel}>{t('doctor.clinicFee')}</Text>
                <Text style={S.feeAmt}>₹{doctor.consultationFee}</Text>
              </View>
            )}
            {doctor.visitFee != null && (
              <View style={S.feeCard}>
                <Text style={S.feeLabel}>{t('doctor.farmVisitFee')}</Text>
                <Text style={S.feeAmt}>₹{doctor.visitFee}</Text>
              </View>
            )}
          </View>
          {doctor.feeNote?.mr && (
            <Text style={S.feeNote}>ℹ️ {doctor.feeNote.mr}</Text>
          )}
        </View>

        {/* ── Languages ── */}
        {doctor.languages?.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('doctor.languagesSection')}</Text>
            <Text style={S.langText}>{doctor.languages.join(' · ')}</Text>
          </View>
        )}

        {/* ── Reviews ── */}
        <View style={S.section}>
          <View style={S.revHeader}>
            <Text style={S.sectionTitle}>{t('doctor.ratingsSection', { count: doctor.rating?.count || 0 })}</Text>
            <TouchableOpacity style={S.writeRevBtn} onPress={() => setShowForm(v => !v)}>
              <Text style={S.writeRevBtnText}>{t('doctor.writeReview')}</Text>
            </TouchableOpacity>
          </View>

          {/* Write review form */}
          {showForm && (
            <View style={S.reviewForm}>
              <Text style={S.revFormTitle}>{t('doctor.reviewFormTitle')}</Text>
              <StarPicker value={myRating} onChange={setMyRating} />
              <TextInput
                style={S.commentInput}
                placeholder={t('doctor.reviewCommentPlaceholder')}
                placeholderTextColor={COLORS.grayLight2}
                multiline
                value={myComment}
                onChangeText={setMyComment}
                maxLength={500}
              />
              <TouchableOpacity
                style={[S.submitRevBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={S.submitRevBtnText}>{t('doctor.submitReview')}</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Reviews list */}
          {reviews.map(rv => <ReviewRow key={rv.id} review={rv} t={t} />)}

          {loadingRev && <ActivityIndicator style={{ margin: 12 }} color={COLORS.greenDeep} />}

          {!loadingRev && reviewMeta && reviewMeta.page < reviewMeta.totalPages && (
            <TouchableOpacity
              style={S.loadMoreBtn}
              onPress={() => loadReviews(reviewMeta.page + 1)}
            >
              <Text style={S.loadMoreText}>{t('doctor.loadMoreReviews')}</Text>
            </TouchableOpacity>
          )}

          {!loadingRev && reviews.length === 0 && (
            <Text style={S.noReview}>{t('doctor.noReviews')}</Text>
          )}
        </View>

        {/* Spacer for sticky bar */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Sticky CTA bar ── */}
      <View style={[S.stickyBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={S.stickyCall} onPress={handleCall} activeOpacity={0.85}>
          <Ionicons name="call" size={18} color={COLORS.white} />
          <Text style={S.stickyCallText}>{t('doctor.callDoctor')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.stickyWa} onPress={handleWhatsApp} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
          <Text style={S.stickyWaText}>{t('doctor.whatsappDoctor')}</Text>
        </TouchableOpacity>
      </View>
    </AnimatedScreen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:    { fontSize: 16, color: COLORS.textBody },
  scroll:       { paddingBottom: 20 },

  // Back btn
  backBtn:      { position: 'absolute', top: 52, left: 16, zIndex: 10,
                  backgroundColor: COLORS.white, borderRadius: 20, padding: 6,
                  shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },

  // Hero
  hero:         { backgroundColor: COLORS.white, alignItems: 'center', paddingTop: 56, paddingBottom: 20,
                  paddingHorizontal: 20, marginBottom: 12,
                  shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  heroAvatar:   { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryPale,
                  alignItems: 'center', justifyContent: 'center', borderWidth: 3,
                  borderColor: COLORS.greenDeep, marginBottom: 12 },
  heroName:     { fontSize: 20, fontWeight: '900', color: COLORS.textDark, textAlign: 'center', marginBottom: 6 },
  heroRatingRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  heroRating:   { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  heroRatingCount: { fontSize: 12, color: COLORS.textLight },
  heroMeta:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  availPill:    { flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: COLORS.successLight, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 12 },
  greenDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.greenBright },
  availPillText:{ fontSize: 12, fontWeight: '700', color: COLORS.greenDark2 },
  locPill:      { flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: COLORS.grayBg, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 12 },
  locText:      { fontSize: 12, color: COLORS.textBody },

  // Section
  section:      { backgroundColor: COLORS.white, marginHorizontal: 12, marginBottom: 10,
                  borderRadius: 14, padding: 16,
                  shadowColor: COLORS.black, shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.greenDeep, marginBottom: 10 },

  // Qualifications
  qualRow:      { flexDirection: 'row', gap: 8, marginBottom: 7, alignItems: 'flex-start' },
  qualText:     { flex: 1, fontSize: 13, color: COLORS.grayDark2, lineHeight: 19 },

  // Animal tags
  tagWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:          { backgroundColor: COLORS.primaryPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText:      { fontSize: 13, color: COLORS.warmGreen, fontWeight: '600' },

  // Services
  serviceGrid:  { gap: 8 },
  serviceItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceText:  { fontSize: 13, color: COLORS.grayDark2 },

  // Availability
  availInfo:    { fontSize: 13, color: COLORS.grayDark2, lineHeight: 20, marginBottom: 8 },
  emergencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: COLORS.errorLight, paddingHorizontal: 10, paddingVertical: 7,
                    borderRadius: 8 },
  emergencyText:  { fontSize: 13, color: COLORS.error, fontWeight: '700' },

  // Fees
  feeRow:       { flexDirection: 'row', gap: 12 },
  feeCard:      { flex: 1, backgroundColor: COLORS.greenPaper, borderRadius: 10, padding: 12, alignItems: 'center' },
  feeLabel:     { fontSize: 11, color: COLORS.textBody, marginBottom: 4 },
  feeAmt:       { fontSize: 20, fontWeight: '900', color: COLORS.greenDeep },
  feeNote:      { fontSize: 12, color: COLORS.textLight, marginTop: 8 },

  // Languages
  langText:     { fontSize: 13, color: COLORS.grayDark2, textTransform: 'capitalize' },

  // Reviews
  revHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  writeRevBtn:  { backgroundColor: COLORS.primaryPale, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  writeRevBtnText: { fontSize: 13, color: COLORS.greenDeep, fontWeight: '700' },
  reviewForm:   { backgroundColor: COLORS.greenWhite, borderRadius: 10, padding: 14, marginBottom: 14,
                  borderWidth: 1, borderColor: COLORS.greenPale200, gap: 12 },
  revFormTitle: { fontSize: 14, fontWeight: '700', color: COLORS.greenDeep },
  commentInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10,
                  fontSize: 13, color: COLORS.textDark, minHeight: 70, textAlignVertical: 'top',
                  backgroundColor: COLORS.white },
  submitRevBtn: { backgroundColor: COLORS.greenDeep, borderRadius: 10, paddingVertical: 12,
                  alignItems: 'center' },
  submitRevBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  loadMoreBtn:  { paddingVertical: 12, alignItems: 'center' },
  loadMoreText: { color: COLORS.greenDeep, fontSize: 13, fontWeight: '700' },
  noReview:     { color: COLORS.textLight, fontSize: 13, textAlign: 'center', paddingVertical: 16 },

  // Sticky bar
  stickyBar:    { position: 'absolute', bottom: 0, left: 0, right: 0,
                  flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
                  backgroundColor: COLORS.white,
                  borderTopWidth: 1, borderTopColor: COLORS.gray100alt,
                  shadowColor: COLORS.black, shadowOffset: { width: 0, height: -3 },
                  shadowOpacity: 0.08, shadowRadius: 6, elevation: 8 },
  stickyCall:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: COLORS.greenDeep, borderRadius: 12, paddingVertical: 13 },
  stickyCallText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
  stickyWa:     { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: COLORS.whatsappGreen, borderRadius: 12, paddingVertical: 13 },
  stickyWaText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
