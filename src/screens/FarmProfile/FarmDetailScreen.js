/**
 * FarmDetailScreen — AI-powered farm dashboard with insights, weather, crop timeline, soil badges, predictions.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMultiFarm } from '../../context/MultiFarmContext';
import { useLanguage } from '../../context/LanguageContext';
import * as farmApi from '../../services/farmApi';
import { COLORS, RADIUS } from '../../constants/colors';
import { s, vs, fs } from '../../utils/responsive';

const STAGES = [
  { key: 'PLANNING', icon: 'clipboard-outline', color: '#9E9E9E' },
  { key: 'LAND_PREP', icon: 'construct-outline', color: '#795548' },
  { key: 'SOWING', icon: 'leaf-outline', color: '#4CAF50' },
  { key: 'VEGETATIVE', icon: 'trending-up-outline', color: '#8BC34A' },
  { key: 'FLOWERING', icon: 'flower-outline', color: '#E91E63' },
  { key: 'FRUITING', icon: 'nutrition-outline', color: '#FF9800' },
  { key: 'MATURITY', icon: 'checkmark-circle-outline', color: '#F57F17' },
  { key: 'HARVESTED', icon: 'basket-outline', color: '#2E7D32' },
];

export default function FarmDetailScreen({ navigation, route }) {
  const { t } = useLanguage();
  const { activeFarmId, switchActiveFarm } = useMultiFarm();
  const { farmId } = route.params;
  const [farm, setFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setFarm(await farmApi.getFarm(farmId)); }
    catch { Alert.alert(t('login.error'), t('farmProfile.loadError')); }
    finally { setLoading(false); setRefreshing(false); }
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!farm) return <View style={styles.center}><Text>{t('farmProfile.notFound')}</Text></View>;

  const isActive = farm.id === activeFarmId;
  const soil = farm.soilReports?.[0];
  const cycles = farm.cropCycles || [];

  // Smart insights
  const insights = [];
  if (soil?.nitrogenRating === 'low') insights.push({ icon: 'alert-circle', color: '#F44336', text: 'Soil nitrogen is LOW — apply Urea or FYM before sowing' });
  if (soil?.phRating === 'acidic') insights.push({ icon: 'flask', color: '#FF9800', text: 'Soil is acidic (pH < 6.5) — apply lime 2 qtl/acre' });
  if (farm.irrigationSystem === 'RAINFED') insights.push({ icon: 'rainy-outline', color: '#2196F3', text: 'Rainfed farm — monitor IMD forecasts closely' });
  if (!soil) insights.push({ icon: 'document-text-outline', color: '#9C27B0', text: 'Upload soil health card for precise fertilizer advice' });
  if (cycles.length === 0) insights.push({ icon: 'leaf-outline', color: '#4CAF50', text: 'No active crops — ask AI which crop suits your farm' });

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}>
      {/* Hero */}
      <LinearGradient colors={[COLORS.primary, '#2E7D32']} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{farm.farmName || farm.farmAlias}</Text>
            <Text style={styles.heroLoc}>{[farm.village, farm.taluka, farm.district].filter(Boolean).join(', ')}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('FarmAddEdit', { farm })} style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.heroStats}>
          <HStat icon="resize-outline" value={`${farm.landSizeAcres}`} label={t('farmProfile.acres')} />
          <HStat icon="earth-outline" value={(farm.soilType || '').replace('_', ' ')} label={t('farmProfile.soil')} />
          <HStat icon="water-outline" value={farm.irrigationSystem} label={t('farmProfile.irrigation')} />
        </View>
        {!isActive && <TouchableOpacity style={styles.setActiveBtn} onPress={() => switchActiveFarm(farm.id)}>
          <Ionicons name="star-outline" size={14} color="#FFF" /><Text style={styles.setActiveText}>{t('farmProfile.setActive')}</Text>
        </TouchableOpacity>}
        {isActive && <View style={styles.activePill}><Ionicons name="star" size={12} color="#FFD700" /><Text style={styles.activePillText}>Active Farm — AI uses this data</Text></View>}
      </LinearGradient>

      {/* Insights */}
      {insights.length > 0 && <Section icon="bulb-outline" color="#FF9800" title={t('farmProfile.aiInsights')}>
        {insights.map((ins, i) => <View key={i} style={styles.insightRow}><Ionicons name={ins.icon} size={16} color={ins.color} /><Text style={styles.insightText}>{ins.text}</Text></View>)}
      </Section>}

      {/* Crop Cycles */}
      <Section icon="leaf-outline" color="#4CAF50" title={t('farmProfile.activeCrops')} right={
        <TouchableOpacity onPress={() => navigation.navigate('CropCycleCreate', { farmId: farm.id })}><Text style={styles.addLink}>+ Add</Text></TouchableOpacity>
      }>
        {cycles.length === 0 ? (
          <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.navigate('CropCycleCreate', { farmId: farm.id })}>
            <Ionicons name="add-circle" size={32} color="#4CAF50" />
            <Text style={styles.emptyActionText}>{t('farmProfile.startCropCycle')}</Text>
          </TouchableOpacity>
        ) : cycles.map(c => (
          <TouchableOpacity key={c.id} style={styles.cycleCard} onPress={() => navigation.navigate('CropCycleDetail', { cycleId: c.id })} activeOpacity={0.7}>
            <Text style={styles.cycleName}>{c.cropName} {c.variety ? `(${c.variety})` : ''}</Text>
            <Text style={styles.cycleMeta}>{c.areaAllocatedAcres} ac | {c.season} {c.year} | {c.growthStage?.replace('_', ' ')}</Text>
            {/* Growth timeline */}
            <View style={styles.timeline}>
              {STAGES.map((st, i) => {
                const cur = STAGES.findIndex(s => s.key === c.growthStage);
                return <View key={st.key} style={styles.tlStep}>
                  <View style={[styles.tlDot, i <= cur && { backgroundColor: st.color }, i === cur && styles.tlDotCur]}>
                    {i === cur && <Ionicons name={st.icon} size={8} color="#FFF" />}
                  </View>
                  {i < STAGES.length - 1 && <View style={[styles.tlLine, i < cur && { backgroundColor: st.color }]} />}
                </View>;
              })}
            </View>
          </TouchableOpacity>
        ))}
      </Section>

      {/* Soil */}
      <Section icon="flask-outline" color="#9C27B0" title={t('farmProfile.soilHealth')}>
        {soil ? <View style={styles.soilRow}>
          <SBadge l="pH" v={soil.ph} r={soil.phRating} /><SBadge l="N" v={soil.nitrogen} r={soil.nitrogenRating} />
          <SBadge l="P" v={soil.phosphorus} r={soil.phosphorusRating} /><SBadge l="K" v={soil.potassium} r={soil.potassiumRating} />
          <SBadge l="OC" v={soil.organicCarbon} r={soil.organicCarbonRating} />
        </View> : <Text style={styles.muted}>{t('farmProfile.noSoilReport')}</Text>}
      </Section>

      {/* AI Actions */}
      <Section icon="sparkles-outline" color="#FF9800" title={t('farmProfile.aiPredictions')}>
        <View style={styles.predGrid}>
          <PredCard icon="chatbubble-ellipses" color="#4CAF50" title={t('farmProfile.askFarmMind')} sub={t('farmProfile.chatAboutFarm')} onPress={() => navigation.navigate('AIAssistant', { screen: 'AIChat', params: { initialMessage: `Advise me on my ${farm.landSizeAcres} acre farm in ${farm.district} with ${(farm.soilType || '').replace('_', ' ')} soil and ${farm.irrigationSystem} irrigation.` } })} />
          <PredCard icon="trending-up" color="#2196F3" title={t('farmProfile.bestCrop')} sub={t('farmProfile.top5Soil')} onPress={() => {}} />
          <PredCard icon="calculator" color="#9C27B0" title={t('farmProfile.seedQty')} sub={t('farmProfile.exactKg')} onPress={() => {}} />
          <PredCard icon="cash" color="#FF9800" title={t('farmProfile.income')} sub={t('farmProfile.forecastRevenue')} onPress={() => {}} />
        </View>
      </Section>

      <View style={{ height: vs(30) }} />
    </ScrollView>
  );
}

function Section({ icon, color, title, right, children }) {
  return <View style={styles.section}>
    <View style={styles.secHeader}><View style={[styles.secIcon, { backgroundColor: color + '15' }]}><Ionicons name={icon} size={15} color={color} /></View><Text style={styles.secTitle}>{title}</Text><View style={{ flex: 1 }} />{right}</View>
    {children}
  </View>;
}

function HStat({ icon, value, label }) {
  return <View style={styles.hStat}><Ionicons name={icon} size={14} color="rgba(255,255,255,0.6)" /><Text style={styles.hVal}>{value || '—'}</Text><Text style={styles.hLbl}>{label}</Text></View>;
}

function SBadge({ l, v, r }) {
  const c = r === 'high' ? '#4CAF50' : r === 'low' ? '#F44336' : '#FF9800';
  return <View style={styles.sBadge}><Text style={styles.sBadgeLbl}>{l}</Text><Text style={[styles.sBadgeVal, { color: c }]}>{v ?? '—'}</Text><View style={[styles.sBadgePill, { backgroundColor: c + '15' }]}><Text style={[styles.sBadgeRat, { color: c }]}>{r || '—'}</Text></View></View>;
}

function PredCard({ icon, color, title, sub, onPress }) {
  return <TouchableOpacity style={styles.predCard} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.predIcon, { backgroundColor: color + '12' }]}><Ionicons name={icon} size={20} color={color} /></View>
    <Text style={styles.predTitle}>{title}</Text><Text style={styles.predSub}>{sub}</Text>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { paddingTop: vs(16), paddingBottom: vs(18), paddingHorizontal: s(16) },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroName: { fontSize: fs(22), fontWeight: '800', color: '#FFF' },
  heroLoc: { fontSize: fs(12), color: 'rgba(255,255,255,0.7)', marginTop: vs(3) },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  heroStats: { flexDirection: 'row', marginTop: vs(14), gap: s(4) },
  hStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: vs(10), alignItems: 'center', gap: vs(3) },
  hVal: { fontSize: fs(13), fontWeight: '700', color: '#FFF', textTransform: 'capitalize' },
  hLbl: { fontSize: fs(10), color: 'rgba(255,255,255,0.5)' },
  setActiveBtn: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: vs(12), alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: s(14), paddingVertical: vs(6), borderRadius: 20 },
  setActiveText: { fontSize: fs(12), color: '#FFF', fontWeight: '600' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: vs(12), alignSelf: 'center', backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: s(14), paddingVertical: vs(6), borderRadius: 20 },
  activePillText: { fontSize: fs(12), color: '#FFD700', fontWeight: '600' },
  section: { backgroundColor: '#FFF', marginHorizontal: s(12), marginTop: vs(12), borderRadius: 14, padding: s(14), elevation: 1 },
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: vs(10) },
  secIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  secTitle: { fontSize: fs(15), fontWeight: '700', color: '#1A1A1A' },
  addLink: { fontSize: fs(13), color: COLORS.cta, fontWeight: '600' },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingVertical: vs(7), borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  insightText: { flex: 1, fontSize: fs(13), color: '#333', lineHeight: fs(18) },
  cycleCard: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: s(12), marginBottom: vs(8), borderWidth: 1, borderColor: '#F0F0F0' },
  cycleName: { fontSize: fs(15), fontWeight: '700', color: '#1A1A1A' },
  cycleMeta: { fontSize: fs(11), color: '#666', marginTop: vs(2), textTransform: 'capitalize' },
  timeline: { flexDirection: 'row', alignItems: 'center', marginTop: vs(8) },
  tlStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  tlDotCur: { width: 18, height: 18, borderRadius: 9 },
  tlLine: { flex: 1, height: 2, backgroundColor: '#E0E0E0' },
  emptyAction: { alignItems: 'center', padding: s(20), gap: vs(8) },
  emptyActionText: { fontSize: fs(14), fontWeight: '600', color: '#4CAF50' },
  soilRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sBadge: { flex: 1, alignItems: 'center', gap: vs(3) },
  sBadgeLbl: { fontSize: fs(11), color: '#999', fontWeight: '700' },
  sBadgeVal: { fontSize: fs(15), fontWeight: '800' },
  sBadgePill: { paddingHorizontal: s(6), paddingVertical: vs(1), borderRadius: 6 },
  sBadgeRat: { fontSize: fs(9), fontWeight: '700', textTransform: 'uppercase' },
  muted: { fontSize: fs(13), color: '#999' },
  predGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
  predCard: { width: '47%', backgroundColor: '#FAFAFA', borderRadius: 12, padding: s(12), gap: vs(4) },
  predIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  predTitle: { fontSize: fs(13), fontWeight: '700', color: '#1A1A1A' },
  predSub: { fontSize: fs(11), color: '#999' },
});
