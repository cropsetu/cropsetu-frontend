/**
 * CropCycleDetailScreen — Full cycle view with growth timeline, inputs, financials.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText, Line, Circle } from 'react-native-svg';
import CropIcon from '../../components/CropIcons';
import { useLanguage } from '../../context/LanguageContext';
import * as farmApi from '../../services/farmApi';
import { COLORS } from '../../constants/colors';
import { s, vs, fs } from '../../utils/responsive';

const STAGES = ['PLANNING', 'LAND_PREP', 'SOWING', 'VEGETATIVE', 'FLOWERING', 'FRUITING', 'MATURITY', 'HARVESTED'];
const STAGE_COLORS = ['#9E9E9E', '#795548', '#4CAF50', '#8BC34A', '#E91E63', '#FF9800', '#F57F17', '#2E7D32'];

export default function CropCycleDetailScreen({ navigation, route }) {
  const { t } = useLanguage();
  const { cycleId } = route.params;
  const [cycle, setCycle] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'fertilizer' | 'pesticide' | 'irrigation' | 'harvest' | 'sale'
  const [formData, setFormData] = useState({});

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([farmApi.getCropCycle(cycleId), farmApi.getCycleFinancials(cycleId).catch(() => null)]);
      setCycle(c); setFinancials(f);
    } catch { Alert.alert(t('login.error'), t('farmProfile.loadCropCycleError')); }
    finally { setLoading(false); }
  }, [cycleId]);

  useEffect(() => { load(); }, [load]);

  const submitModal = async () => {
    try {
      if (modal === 'fertilizer') await farmApi.addFertilizer(cycleId, formData);
      else if (modal === 'pesticide') await farmApi.addPesticide(cycleId, formData);
      else if (modal === 'irrigation') await farmApi.addIrrigationLog(cycleId, formData);
      else if (modal === 'harvest') await farmApi.recordHarvest(cycleId, formData);
      else if (modal === 'sale') await farmApi.recordSale(cycleId, formData);
      setModal(null); setFormData({}); load();
    } catch (e) { Alert.alert(t('login.error'), e.message || t('farmProfile.saveFailed')); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!cycle) return <View style={styles.center}><Text>{t('farmProfile.notFound')}</Text></View>;

  const curIdx = STAGES.indexOf(cycle.growthStage);
  const ferts = Array.isArray(cycle.fertilizersUsed) ? cycle.fertilizersUsed : [];
  const pests = Array.isArray(cycle.pesticidesUsed) ? cycle.pesticidesUsed : [];
  const irrLogs = Array.isArray(cycle.irrigationLogs) ? cycle.irrigationLogs : [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      {/* Hero */}
      <LinearGradient colors={[COLORS.primary, '#2E7D32']} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.cropIconWrap}><CropIcon crop={cycle.cropName} size={48} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{cycle.cropName} {cycle.variety ? `(${cycle.variety})` : ''}</Text>
            <Text style={styles.heroMeta}>{cycle.areaAllocatedAcres} ac | {cycle.season} {cycle.year} | {cycle.growthStage?.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Growth Timeline */}
        <View style={styles.timeline}>
          {STAGES.map((st, i) => (
            <View key={st} style={styles.tlStep}>
              <View style={[styles.tlDot, i <= curIdx && { backgroundColor: STAGE_COLORS[i] }, i === curIdx && styles.tlDotCur]}>
                {i === curIdx && <Ionicons name="checkmark" size={8} color="#FFF" />}
              </View>
              {i < STAGES.length - 1 && <View style={[styles.tlLine, i < curIdx && { backgroundColor: STAGE_COLORS[i] }]} />}
            </View>
          ))}
        </View>
        <View style={styles.tlLabels}><Text style={styles.tlLbl}>{t('farmProfile.planLabel')}</Text><View style={{ flex: 1 }} /><Text style={styles.tlLbl}>{t('farmProfile.harvestLabel')}</Text></View>
      </LinearGradient>

      {/* Financials Bar Chart */}
      {financials && (financials.totalInputCostInr > 0 || financials.revenue > 0) && (
        <View style={styles.section}>
          <Text style={styles.secTitle}>Profit & Loss</Text>
          <View style={styles.finCards}>
            <FinCard label={t('farmProfile.totalCost')} value={`₹${(financials.totalInputCostInr || 0).toLocaleString('en-IN')}`} color="#F44336" icon="trending-down" />
            <FinCard label={t('farmProfile.revenue')} value={`₹${(financials.revenue || 0).toLocaleString('en-IN')}`} color="#4CAF50" icon="trending-up" />
            <FinCard label={(financials.netProfitInr || 0) >= 0 ? 'Profit' : 'Loss'} value={`₹${Math.abs(financials.netProfitInr || 0).toLocaleString('en-IN')}`} color={(financials.netProfitInr || 0) >= 0 ? '#4CAF50' : '#F44336'} icon={(financials.netProfitInr || 0) >= 0 ? 'arrow-up' : 'arrow-down'} />
          </View>
          {/* Cost breakdown SVG bar */}
          {financials.costBreakdown?.length > 0 && <View style={styles.barChart}>
            <Svg height={30} width="100%">
              {(() => {
                const total = financials.costBreakdown.reduce((s, c) => s + c.value, 0);
                let x = 0;
                return financials.costBreakdown.map((c, i) => {
                  const w = total > 0 ? (c.value / total) * 100 : 0;
                  const el = <Rect key={i} x={`${x}%`} y={0} width={`${w}%`} height={30} rx={i === 0 ? 6 : 0} fill={c.color} />;
                  x += w;
                  return el;
                });
              })()}
            </Svg>
            <View style={styles.legend}>
              {financials.costBreakdown.map((c, i) => <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: c.color }]} /><Text style={styles.legendText}>{c.label} ₹{c.value.toLocaleString('en-IN')}</Text>
              </View>)}
            </View>
          </View>}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionGrid}>
        <ActionBtn icon="flask" color="#2196F3" label={t('farmProfile.addFertilizer')} onPress={() => { setFormData({}); setModal('fertilizer'); }} />
        <ActionBtn icon="bug" color="#F44336" label={t('farmProfile.addPesticide')} onPress={() => { setFormData({}); setModal('pesticide'); }} />
        <ActionBtn icon="water" color="#00BCD4" label={t('farmProfile.logIrrigation')} onPress={() => { setFormData({}); setModal('irrigation'); }} />
        <ActionBtn icon="basket" color="#FF9800" label={t('farmProfile.recordHarvest')} onPress={() => { setFormData({}); setModal('harvest'); }} />
        <ActionBtn icon="cash" color="#4CAF50" label={t('farmProfile.recordSale')} onPress={() => { setFormData({}); setModal('sale'); }} />
        <ActionBtn icon="checkmark-done" color="#9C27B0" label={t('farmProfile.complete')} onPress={async () => { await farmApi.completeCycle(cycleId); load(); }} />
      </View>

      {/* Input History */}
      {ferts.length > 0 && <Section title={`Fertilizers (${ferts.length})`} icon="flask-outline" color="#2196F3">
        {ferts.map((f, i) => <InputRow key={i} name={f.productName} date={f.applicationDate} cost={f.costInr} qty={f.quantityKg ? `${f.quantityKg} kg` : ''} />)}
      </Section>}

      {pests.length > 0 && <Section title={`Pesticides (${pests.length})`} icon="bug-outline" color="#F44336">
        {pests.map((p, i) => <InputRow key={i} name={p.productName} date={p.applicationDate} cost={p.costInr} qty={p.quantityMl ? `${p.quantityMl} ml` : ''} />)}
      </Section>}

      {irrLogs.length > 0 && <Section title={`Irrigation (${irrLogs.length})`} icon="water-outline" color="#00BCD4">
        {irrLogs.map((l, i) => <InputRow key={i} name={l.method || 'Irrigation'} date={l.date} qty={l.durationHours ? `${l.durationHours}h` : ''} />)}
      </Section>}

      <View style={{ height: vs(30) }} />

      {/* Input Modals */}
      <InputModal visible={modal === 'fertilizer'} title={t('farmProfile.addFertilizer')} onClose={() => setModal(null)} onSave={submitModal}
        fields={[{ key: 'productName', label: 'Product Name *', ph: 'e.g. Urea, DAP' }, { key: 'quantityKg', label: 'Quantity (kg)', ph: '50', kb: 'decimal-pad' }, { key: 'costInr', label: 'Cost (₹)', ph: '1500', kb: 'numeric' }]}
        data={formData} setData={setFormData} />
      <InputModal visible={modal === 'pesticide'} title={t('farmProfile.addPesticide')} onClose={() => setModal(null)} onSave={submitModal}
        fields={[{ key: 'productName', label: 'Product Name *', ph: 'e.g. Imidacloprid' }, { key: 'activeIngredient', label: 'Active Ingredient', ph: 'e.g. Dimethoate' }, { key: 'quantityMl', label: 'Quantity (ml)', ph: '500', kb: 'decimal-pad' }, { key: 'costInr', label: 'Cost (₹)', ph: '800', kb: 'numeric' }]}
        data={formData} setData={setFormData} />
      <InputModal visible={modal === 'irrigation'} title={t('farmProfile.logIrrigation')} onClose={() => setModal(null)} onSave={submitModal}
        fields={[{ key: 'method', label: 'Method', ph: 'drip / flood / sprinkler' }, { key: 'durationHours', label: 'Duration (hours)', ph: '3', kb: 'decimal-pad' }]}
        data={formData} setData={setFormData} />
      <InputModal visible={modal === 'harvest'} title={t('farmProfile.recordHarvest')} onClose={() => setModal(null)} onSave={submitModal}
        fields={[{ key: 'yieldKg', label: 'Yield (kg) *', ph: '2500', kb: 'decimal-pad' }, { key: 'qualityGrade', label: 'Quality Grade', ph: 'A / B / C' }]}
        data={formData} setData={setFormData} />
      <InputModal visible={modal === 'sale'} title={t('farmProfile.recordSale')} onClose={() => setModal(null)} onSave={submitModal}
        fields={[{ key: 'soldQuantityKg', label: 'Quantity (kg) *', ph: '2000', kb: 'decimal-pad' }, { key: 'pricePerKgInr', label: 'Price per kg (₹) *', ph: '45', kb: 'decimal-pad' }, { key: 'buyerName', label: 'Buyer / Mandi', ph: 'Nashik APMC' }]}
        data={formData} setData={setFormData} />
    </ScrollView>
  );
}

function Section({ title, icon, color, children }) {
  return <View style={styles.section}><View style={styles.secHeader}><Ionicons name={icon} size={16} color={color} /><Text style={styles.secTitle}>{title}</Text></View>{children}</View>;
}

function FinCard({ label, value, color, icon }) {
  return <View style={[styles.finCard, { borderLeftColor: color }]}><Ionicons name={icon} size={16} color={color} /><Text style={styles.finLabel}>{label}</Text><Text style={[styles.finValue, { color }]}>{value}</Text></View>;
}

function ActionBtn({ icon, color, label, onPress }) {
  return <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.actionIcon, { backgroundColor: color + '12' }]}><Ionicons name={icon} size={18} color={color} /></View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>;
}

function InputRow({ name, date, cost, qty }) {
  return <View style={styles.inputRow}>
    <View style={{ flex: 1 }}><Text style={styles.inputName}>{name}</Text>{date && <Text style={styles.inputDate}>{new Date(date).toLocaleDateString('en-IN')}</Text>}</View>
    {qty ? <Text style={styles.inputQty}>{qty}</Text> : null}
    {cost ? <Text style={styles.inputCost}>₹{parseFloat(cost).toLocaleString('en-IN')}</Text> : null}
  </View>;
}

function InputModal({ visible, title, onClose, onSave, fields, data, setData }) {
  const { t } = useLanguage();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
    <View style={styles.modalSheet}>
      <View style={styles.modalHandle} />
      <Text style={styles.modalTitle}>{title}</Text>
      {fields.map(f => <View key={f.key}>
        <Text style={styles.modalLabel}>{f.label}</Text>
        <TextInput style={styles.modalInput} value={data[f.key] || ''} onChangeText={v => setData(p => ({ ...p, [f.key]: v }))} placeholder={f.ph} keyboardType={f.kb || 'default'} placeholderTextColor="#999" />
      </View>)}
      <TouchableOpacity style={styles.modalSaveBtn} onPress={onSave}><Text style={styles.modalSaveText}>{t('save')}</Text></TouchableOpacity>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { paddingTop: vs(16), paddingBottom: vs(16), paddingHorizontal: s(16) },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
  cropIconWrap: { width: s(60), height: s(60), borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  heroName: { fontSize: fs(20), fontWeight: '800', color: '#FFF' },
  heroMeta: { fontSize: fs(12), color: 'rgba(255,255,255,0.7)', marginTop: vs(3), textTransform: 'capitalize' },
  timeline: { flexDirection: 'row', alignItems: 'center', marginTop: vs(14), paddingHorizontal: s(4) },
  tlStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  tlDotCur: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  tlLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  tlLabels: { flexDirection: 'row', paddingHorizontal: s(4), marginTop: vs(4) },
  tlLbl: { fontSize: fs(10), color: 'rgba(255,255,255,0.5)' },
  section: { backgroundColor: '#FFF', marginHorizontal: s(12), marginTop: vs(12), borderRadius: 14, padding: s(14), elevation: 1 },
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: vs(8) },
  secTitle: { fontSize: fs(15), fontWeight: '700', color: '#1A1A1A' },
  finCards: { flexDirection: 'row', gap: s(8) },
  finCard: { flex: 1, backgroundColor: '#FAFAFA', borderRadius: 10, padding: s(10), borderLeftWidth: 3, gap: vs(2) },
  finLabel: { fontSize: fs(10), color: '#999' },
  finValue: { fontSize: fs(14), fontWeight: '800' },
  barChart: { marginTop: vs(12) },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginTop: vs(8) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fs(10), color: '#666' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8), paddingHorizontal: s(12), marginTop: vs(12) },
  actionBtn: { width: '31%', backgroundColor: '#FFF', borderRadius: 12, padding: s(10), alignItems: 'center', elevation: 1, gap: vs(4) },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: fs(10), fontWeight: '600', color: '#333', textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(8), borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  inputName: { fontSize: fs(14), fontWeight: '600', color: '#1A1A1A' },
  inputDate: { fontSize: fs(11), color: '#999', marginTop: vs(1) },
  inputQty: { fontSize: fs(12), color: '#666', marginRight: s(10) },
  inputCost: { fontSize: fs(13), fontWeight: '700', color: '#1A1A1A' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: s(20), paddingBottom: vs(30) },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: vs(16) },
  modalTitle: { fontSize: fs(18), fontWeight: '800', color: '#1A1A1A', marginBottom: vs(12) },
  modalLabel: { fontSize: fs(13), fontWeight: '600', color: '#333', marginTop: vs(10), marginBottom: vs(4) },
  modalInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: s(14), paddingVertical: vs(12), fontSize: fs(15), color: '#1A1A1A', backgroundColor: '#FAFAFA' },
  modalSaveBtn: { backgroundColor: COLORS.cta, paddingVertical: vs(14), borderRadius: 12, alignItems: 'center', marginTop: vs(16) },
  modalSaveText: { color: '#FFF', fontSize: fs(15), fontWeight: '700' },
});
