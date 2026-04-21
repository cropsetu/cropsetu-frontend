import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, ScrollView,
  Platform, StatusBar, RefreshControl, Animated,
} from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Haptics } from '../../utils/haptics';
import { getDoctors } from '../../services/doctorApi';
import { trackCallClick, trackWhatsAppClick } from '../../services/doctorApi';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, TYPE, SHADOWS } from '../../constants/colors';
import AnimatedScreen from '../../components/ui/AnimatedScreen';
import useScrollHeader from '../../hooks/useScrollHeader';
import ScrollToTopButton from '../../components/ScrollToTopButton';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ANIMAL_FILTERS = [
  { key: 'cow',     emoji: '🐄' },
  { key: 'buffalo', emoji: '🐃' },
  { key: 'goat',    emoji: '🐐' },
  { key: 'sheep',   emoji: '🐑' },
  { key: 'poultry', emoji: '🐓' },
  { key: 'horse',   emoji: '🐴' },
  { key: 'dog',     emoji: '🐕' },
  { key: 'cat',     emoji: '🐈' },
];

const SERVICE_FILTERS = [
  { key: 'vaccination' },
  { key: 'artificial_insemination' },
  { key: 'emergency' },
  { key: 'surgery' },
  { key: 'farm_visit' },
  { key: 'pregnancy_diagnosis' },
  { key: 'general_checkup' },
  { key: 'telemedicine' },
];

const SORT_OPTIONS = [
  { key: 'rating',   tKey: 'doctor.sortRating' },
  { key: 'fee_asc',  tKey: 'doctor.sortFeeLow' },
  { key: 'fee_desc', tKey: 'doctor.sortFeeHigh' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Doctor Card
// ─────────────────────────────────────────────────────────────────────────────

function DoctorCard({ doc, onPress, navigation, t, index = 0 }) {
  const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
  const available = doc.availability?.days?.includes(today);
  const name = doc.fullName?.mr || doc.fullName?.en || '';
  const quals = Array.isArray(doc.qualifications)
    ? doc.qualifications.map(q => q.degree).join(', ')
    : '';
  const location = [doc.address?.village, doc.address?.district].filter(Boolean).join(', ');
  const dist = doc.distanceKm != null ? `${doc.distanceKm} ${t('doctor.kmAway')}` : location;

  const sc    = useRef(new Animated.Value(1)).current;
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true,
    }).start();
  }, []);

  const entryOpacity = entry.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const entryY       = entry.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  function handleCall() {
    trackCallClick(doc.id);
    Linking.openURL(`tel:${doc.phone}`);
  }

  function handleWhatsApp() {
    trackWhatsAppClick(doc.id);
    const msg = encodeURIComponent(t('doctor.whatsappMsg'));
    Linking.openURL(`whatsapp://send?phone=${doc.phone}&text=${msg}`);
  }

  return (
    <Animated.View style={[{ opacity: entryOpacity, transform: [{ scale: sc }, { translateY: entryY }] }]}>
    <TouchableOpacity
      style={S.card}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 9 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, tension: 150, friction: 7 }).start()}
    >
      {/* Header row */}
      <View style={S.cardHeader}>
        {/* Avatar */}
        <View style={S.avatar}>
          <Ionicons name="person" size={28} color={COLORS.greenDeep} />
        </View>

        {/* Info */}
        <View style={S.cardInfo}>
          <Text style={S.docName}>{name}</Text>
          <View style={S.ratingRow}>
            <Ionicons name="star" size={13} color={COLORS.gold} />
            <Text style={S.ratingText}>
              {doc.rating?.average?.toFixed(1) || '—'}
            </Text>
            <Text style={S.ratingCount}>
              {t('doctor.farmerRatings', { count: doc.rating?.count || 0 })}
            </Text>
            {doc.experienceYears > 0 && (
              <Text style={S.exp}> · {t('doctor.years', { n: doc.experienceYears })}</Text>
            )}
          </View>
          {quals ? <Text style={S.qual}>{quals}</Text> : null}
        </View>

        {/* Available badge */}
        {available ? (
          <View style={S.availBadge}>
            <View style={S.greenDot} />
            <Text style={S.availText}>{t('doctor.available')}</Text>
          </View>
        ) : (
          <View style={[S.availBadge, { backgroundColor: COLORS.goldPale }]}>
            <View style={[S.greenDot, { backgroundColor: COLORS.gold }]} />
            <Text style={[S.availText, { color: COLORS.amberDark2 }]}>{t('doctor.closed')}</Text>
          </View>
        )}
      </View>

      {/* Animal types */}
      {doc.animalLabels?.length > 0 && (
        <Text style={S.animals} numberOfLines={1}>
          {doc.animalLabels.map(a => t(`doctor.animals.${(a.key || a.en || '').toLowerCase()}`) || a.mr || a.en).join(' · ')}
        </Text>
      )}

      {/* Fees + location row */}
      <View style={S.infoRow}>
        {doc.consultationFee != null && (
          <View style={S.infoChip}>
            <Ionicons name="cash-outline" size={13} color={COLORS.greenDeep} />
            <Text style={S.infoChipText}>₹{t('doctor.consultFee', { fee: doc.consultationFee })}</Text>
          </View>
        )}
        {doc.visitFee != null && (
          <View style={S.infoChip}>
            <Ionicons name="car-outline" size={13} color={COLORS.greenDeep} />
            <Text style={S.infoChipText}>₹{t('doctor.visitFee', { fee: doc.visitFee })}</Text>
          </View>
        )}
        <View style={S.infoChip}>
          <Ionicons name="location-outline" size={13} color={COLORS.greenDeep} />
          <Text style={S.infoChipText} numberOfLines={1}>{dist}</Text>
        </View>
        {doc.availability?.emergencyAvailable && (
          <View style={[S.infoChip, { backgroundColor: COLORS.errorLight }]}>
            <Ionicons name="flash" size={12} color={COLORS.error} />
            <Text style={[S.infoChipText, { color: COLORS.error }]}>{t('doctor.emergency')}</Text>
          </View>
        )}
      </View>

      {/* Timing */}
      {doc.availability?.startTime && (
        <Text style={S.timing}>
          🕐 {doc.availability.startTime} — {doc.availability.endTime}
          {'  '}
          {doc.availability.dayLabels?.join(' · ')}
        </Text>
      )}

      {/* CTA row */}
      <View style={S.ctaRow}>
        <TouchableOpacity style={S.callBtn} onPress={handleCall} activeOpacity={0.8}>
          <Ionicons name="call" size={16} color={COLORS.white} />
          <Text style={S.callBtnText}>{t('doctor.callBtn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.waBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
          <Ionicons name="logo-whatsapp" size={16} color={COLORS.white} />
          <Text style={S.waBtnText}>{t('doctor.whatsappBtn')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { onScroll: hideOnScroll, headerHeight, headerOpacity, showTopBtn } = useScrollHeader(280);
  const listRef = useRef(null);

  const [doctors, setDoctors]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [total, setTotal]               = useState(0);

  const [search, setSearch]             = useState('');
  const [selectedAnimal, setAnimal]     = useState(null);
  const [selectedService, setService]   = useState(null);
  const [sortBy, setSort]               = useState('rating');
  const [emergencyOnly, setEmergency]   = useState(false);

  const searchTimer = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchDoctors(opts = {}) {
    const params = {
      page:  opts.page || 1,
      limit: 15,
      sort:  opts.sort ?? sortBy,
    };
    if (opts.search ?? search)         params.search     = opts.search ?? search;
    if (opts.animal ?? selectedAnimal) params.animalType = opts.animal ?? selectedAnimal;
    if (opts.service ?? selectedService) params.service  = opts.service ?? selectedService;
    if (opts.emergency ?? emergencyOnly) params.emergency = 'true';

    const res = await getDoctors(params);
    return res;
  }

  async function loadInitial(overrides = {}) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDoctors({ page: 1, ...overrides });
      setDoctors(res.data || []);
      setTotal(res.meta?.total || 0);
      setHasMore((res.meta?.page || 1) < (res.meta?.totalPages || 1));
      setPage(1);
    } catch (e) {
      console.warn('[DoctorHome]', e.message);
      setError(e.message || t('doctor.serverError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetchDoctors({ page: nextPage });
      setDoctors(prev => [...prev, ...(res.data || [])]);
      setHasMore(nextPage < (res.meta?.totalPages || 1));
      setPage(nextPage);
    } catch (e) {
      console.warn('[DoctorHome loadMore]', e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { loadInitial(); }, []);

  // ── Filter handlers ────────────────────────────────────────────────────────

  function handleSearchChange(text) {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadInitial({ search: text });
    }, 500);
  }

  function toggleAnimal(key) {
    const next = selectedAnimal === key ? null : key;
    setAnimal(next);
    loadInitial({ animal: next });
  }

  function toggleService(key) {
    const next = selectedService === key ? null : key;
    setService(next);
    loadInitial({ service: next });
  }

  function handleSort(key) {
    setSort(key);
    loadInitial({ sort: key });
  }

  function toggleEmergency() {
    const next = !emergencyOnly;
    setEmergency(next);
    loadInitial({ emergency: next });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeFiltersCount = [selectedAnimal, selectedService, emergencyOnly ? 'em' : null].filter(Boolean).length;

  return (

    <AnimatedScreen>
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── All header content (collapses on scroll, doctor list gets full screen) ── */}
      <Animated.View style={{ height: headerHeight, opacity: headerOpacity, overflow: 'hidden' }}>
        <View style={S.header}>
          <View>
            <Text style={S.headerTitle}>{t('doctor.title')}</Text>
            <Text style={S.headerSub}>
              {loading ? t('doctor.searchingDoctors') : t('doctor.doctorsAvailable', { count: total })}
            </Text>
          </View>
          <Ionicons name="medkit" size={28} color={COLORS.greenDeep} />
        </View>

      <View style={S.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.grayMedium} style={S.searchIcon} />
        <TextInput
          style={S.searchInput}
          placeholder={t('doctor.searchPlaceholder')}
          placeholderTextColor={COLORS.grayLight2}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.grayLight2} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter chips ── */}
      <View style={S.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
          {/* Emergency toggle */}
          <TouchableOpacity
            style={[S.chip, emergencyOnly && S.chipActive, { backgroundColor: emergencyOnly ? COLORS.error : COLORS.errorLight }]}
            onPress={toggleEmergency}
          >
            <Text style={[S.chipText, { color: emergencyOnly ? COLORS.white : COLORS.error }]}>{t('doctor.emergencyFilter')}</Text>
          </TouchableOpacity>

          {ANIMAL_FILTERS.map(a => (
            <TouchableOpacity
              key={a.key}
              style={[S.chip, selectedAnimal === a.key && S.chipActive]}
              onPress={() => toggleAnimal(a.key)}
            >
              <Text style={[S.chipText, selectedAnimal === a.key && S.chipTextActive]}>
                {a.emoji} {t(`doctor.animals.${a.key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Service chips ── */}
      <View style={S.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterScroll}>
          {SERVICE_FILTERS.map(sv => (
            <TouchableOpacity
              key={sv.key}
              style={[S.chip, selectedService === sv.key && S.chipActive]}
              onPress={() => toggleService(sv.key)}
            >
              <Text style={[S.chipText, selectedService === sv.key && S.chipTextActive]}>{t(`doctor.services.${sv.key}`)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Sort row ── */}
      <View style={S.sortRow}>
        <Text style={S.sortLabel}>{t('doctor.sortLabel')}</Text>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[S.sortChip, sortBy === s.key && S.sortChipActive]}
            onPress={() => handleSort(s.key)}
          >
            <Text style={[S.sortChipText, sortBy === s.key && S.sortChipTextActive]}>{t(s.tKey)}</Text>
          </TouchableOpacity>
        ))}
        {activeFiltersCount > 0 && (
          <TouchableOpacity
            style={S.clearBtn}
            onPress={() => {
              setAnimal(null); setService(null); setEmergency(false); setSearch('');
              loadInitial({ animal: null, service: null, emergency: false, search: '' });
            }}
          >
            <Text style={S.clearBtnText}>{t('doctor.clearFilters')}</Text>
          </TouchableOpacity>
        )}
      </View>
      </Animated.View>

      {/* ── Doctor list ── */}
      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={COLORS.greenDeep} />
          <Text style={S.loadingText}>{t('doctor.searchingDoctors')}</Text>
        </View>
      ) : error ? (
        <View style={S.center}>
          <Text style={{ fontSize: 36 }}>⚠️</Text>
          <Text style={{ color: COLORS.error, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
            {error}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 16, backgroundColor: COLORS.greenDeep, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}
            onPress={() => loadInitial()}
          >
            <Text style={{ color: COLORS.white, fontWeight: '700' }}>{t('doctor.retryBtn')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          onScroll={hideOnScroll}
          scrollEventThrottle={16}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          data={doctors}
          keyExtractor={d => d.id}
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadInitial(); }}
              colors={[COLORS.greenDeep]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={S.emptyWrap}>
              <View style={S.emptyIconBg}>
                <Ionicons name="medkit-outline" size={36} color={COLORS.greenDeep} />
              </View>
              <Text style={S.emptyTitle}>Coming Soon</Text>
              <Text style={S.emptySub}>Veterinary doctors will be listed here.</Text>
              <Text style={S.emptyHint}>We're onboarding vets in your area.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ margin: 16 }} color={COLORS.greenDeep} />
            ) : null
          }
          renderItem={({ item, index }) => (
            <DoctorCard
              doc={item}
              index={index}
              navigation={navigation}
              onPress={() => navigation.navigate('DoctorDetail', { doctorId: item.id })}
              t={t}
            />
          )}
        />
      )}
      <ScrollToTopButton visible={showTopBtn} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </View>
    </AnimatedScreen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.background },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:  { fontSize: 22, fontWeight: TYPE.weight.black, color: COLORS.primary, letterSpacing: -0.3 },
  headerSub:    { fontSize: 12, color: COLORS.textMedium, marginTop: 3 },

  // Search
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
                  marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14,
                  borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, height: 48, ...SHADOWS.small },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 14, color: COLORS.textDark },

  // Filter chips
  filterSection: { marginBottom: 4 },
  filterScroll:  { paddingHorizontal: 16, gap: 8 },
  chip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22,
                   backgroundColor: COLORS.primarySoft, borderWidth: 1.5, borderColor: COLORS.borderGreen },
  chipActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary,
                   shadowColor: COLORS.primary, shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  chipText:      { fontSize: 13, color: COLORS.primary, fontWeight: TYPE.weight.bold },
  chipTextActive:{ color: COLORS.white },

  // Sort row
  sortRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                   paddingVertical: 8, gap: 8, flexWrap: 'wrap' },
  sortLabel:     { fontSize: 12, color: COLORS.textBody, fontWeight: '600' },
  sortChip:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                   backgroundColor: COLORS.greenMistPale, borderWidth: 1, borderColor: COLORS.greenPale200 },
  sortChipActive:    { backgroundColor: COLORS.warmGreen, borderColor: COLORS.warmGreen },
  sortChipText:      { fontSize: 12, color: COLORS.warmGreen, fontWeight: '600' },
  sortChipTextActive:{ color: COLORS.white },
  clearBtn:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                   backgroundColor: COLORS.redPale, borderWidth: 1, borderColor: COLORS.redPale200 },
  clearBtnText:  { fontSize: 12, color: COLORS.error, fontWeight: '600' },

  // List
  list:         { padding: 12, gap: 12 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { color: COLORS.textBody, fontSize: 14 },
  emptyWrap:   { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryPale, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: '900', color: COLORS.textDark, marginBottom: 6 },
  emptySub:    { fontSize: 14, color: COLORS.textMedium, fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  emptyHint:   { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },

  // Card
  card:         { backgroundColor: COLORS.surface, borderRadius: 22, padding: 16,
                  borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  avatar:       { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryPale,
                  alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: COLORS.greenPale200 },
  cardInfo:     { flex: 1 },
  docName:      { fontSize: 16, fontWeight: TYPE.weight.black, color: COLORS.textDark, marginBottom: 3 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText:   { fontSize: 13, fontWeight: '700', color: COLORS.textDark },
  ratingCount:  { fontSize: 11, color: COLORS.textLight },
  exp:          { fontSize: 11, color: COLORS.textBody },
  qual:         { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

  // Availability badge
  availBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: COLORS.successLight, paddingHorizontal: 8, paddingVertical: 4,
                  borderRadius: 8 },
  greenDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.greenBright },
  availText:    { fontSize: 11, fontWeight: '700', color: COLORS.greenDark2 },

  // Info row
  animals:      { fontSize: 12, color: COLORS.warmGreen, marginBottom: 8, fontWeight: '600' },
  infoRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.greenPaper,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoChipText: { fontSize: 11, color: COLORS.warmGreen, fontWeight: '600' },
  timing:       { fontSize: 11, color: COLORS.grayMid3, marginBottom: 10 },

  // CTA buttons
  ctaRow:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  callBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: COLORS.primary, borderRadius: 13, paddingVertical: 12 },
  callBtnText:  { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  waBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, backgroundColor: COLORS.whatsappGreen, borderRadius: 10, paddingVertical: 11 },
  waBtnText:    { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
