/**
 * FarmAddEditScreen — Single page form with all farm fields.
 * Location + Land/Soil + Irrigation — all visible, no steps.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import LocationPicker from '../../components/LocationPicker';
import { STATE_LIST, getDistrictsForState, DISTRICT_LIST, getTalukas } from '../../constants/locations';
import SoilIcon from '../../components/SoilIcons';
import IrrigationIcon from '../../components/IrrigationIcons';
import { useMultiFarm } from '../../context/MultiFarmContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, TYPE, RADIUS, SHADOWS } from '../../constants/colors';
import { s, vs, fs } from '../../utils/responsive';

const SOILS = [
  { key: 'BLACK_COTTON', tKey: 'crops.soilBlack', sk: 'black', bg: ['#3E3631', '#1A1512'] },
  { key: 'RED', tKey: 'crops.soilRed', sk: 'red', bg: ['#C45A3C', '#8B3626'] },
  { key: 'ALLUVIAL', tKey: 'crops.soilAlluvial', sk: 'alluvial', bg: ['#D4A76A', '#B8935A'] },
  { key: 'SANDY', tKey: 'crops.soilSandy', sk: 'sandy', bg: ['#E8D5A3', '#C9B07A'] },
  { key: 'CLAY_LOAM', tKey: 'crops.soilClay', sk: 'clay', bg: ['#8B7D6B', '#6B5D4B'] },
  { key: 'LATERITE', tKey: 'crops.soilLaterite', sk: 'laterite', bg: ['#CD7F32', '#A0522D'] },
  { key: 'UNKNOWN', tKey: 'crops.soilNA', sk: null, bg: ['#9E9E9E', '#757575'] },
];
const IRRS = [
  { key: 'DRIP', tKey: 'crops.irrDrip', ik: 'drip', color: '#2196F3' },
  { key: 'SPRINKLER', tKey: 'crops.irrSprinkler', ik: 'sprinkler', color: '#00BCD4' },
  { key: 'FLOOD', tKey: 'crops.irrFlood', ik: 'flood', color: '#4CAF50' },
  { key: 'RAINFED', tKey: 'crops.irrRainfed', ik: 'rainfed', color: '#FF9800' },
];

export default function FarmAddEditScreen({ navigation, route }) {
  const { t } = useLanguage();
  const { addFarm, editFarm } = useMultiFarm();
  const existing = route.params?.farm;
  const isEdit = !!existing;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    farmName: existing?.farmName || '', state: existing?.state || 'Maharashtra',
    district: existing?.district || '', taluka: existing?.taluka || '',
    village: existing?.village || '', pincode: existing?.pincode || '',
    latitude: existing?.latitude || null, longitude: existing?.longitude || null,
    landSizeAcres: existing?.landSizeAcres?.toString() || '', soilType: existing?.soilType || 'UNKNOWN',
    irrigationSystem: existing?.irrigationSystem || 'RAINFED',
  });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const captureGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      u('latitude', loc.coords.latitude); u('longitude', loc.coords.longitude);
    } catch { Alert.alert(t('farmProfile.gpsErrorTitle'), t('farmProfile.gpsErrorMsg')); }
  };

  const handleSave = async () => {
    if (!form.landSizeAcres || parseFloat(form.landSizeAcres) <= 0) { Alert.alert(t('farmProfile.requiredTitle'), t('farmProfile.landRequired')); return; }
    setSaving(true);
    try {
      if (isEdit) await editFarm(existing.id, form);
      else await addFarm(form);
      navigation.goBack();
    } catch (e) { Alert.alert(t('login.error'), e.message || t('farmProfile.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={S.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Section 1: Location ── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={[S.secIcon, { backgroundColor: '#4CAF50' + '15' }]}><Ionicons name="location" size={16} color="#4CAF50" /></View>
            <Text style={S.secTitle}>{t('farmProfile.farmLocation')}</Text>
          </View>

          <Text style={S.label}>{t('farmProfile.farmName')}</Text>
          <TextInput style={S.input} value={form.farmName} onChangeText={v => u('farmName', v)} placeholder={t('farmProfile.farmNamePlaceholder')} placeholderTextColor="#999" />

          <Text style={S.label}>{t('farmProfile.state')}</Text>
          <LocationPicker title={t('farmProfile.selectState')} items={STATE_LIST} selected={form.state} onSelect={v => { u('state', v); u('district', ''); u('taluka', ''); }} placeholder={t('farmProfile.selectStatePlaceholder')} />

          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.label}>{t('farmProfile.district')}</Text>
              <LocationPicker title={t('farmProfile.districtTitle')} items={getDistrictsForState(form.state)} selected={form.district} onSelect={v => { u('district', v); u('taluka', ''); }} placeholder={t('farmProfile.selectPlaceholder')} disabled={!form.state} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.label}>{t('farmProfile.taluka')}</Text>
              <LocationPicker title={t('farmProfile.taluka')} items={form.state === 'Maharashtra' ? getTalukas(form.district) : []} selected={form.taluka} onSelect={v => u('taluka', v)} placeholder={form.state === 'Maharashtra' ? t('farmProfile.selectPlaceholder') : t('farmProfile.typeBelow')} disabled={form.state === 'Maharashtra' ? !form.district : true} />
            </View>
          </View>

          {form.state !== 'Maharashtra' && (
            <View>
              <Text style={S.label}>{t('farmProfile.taluka')}</Text>
              <TextInput style={S.input} value={form.taluka} onChangeText={v => u('taluka', v)} placeholder={t('farmProfile.talukaPlaceholder')} placeholderTextColor="#999" />
            </View>
          )}

          <View style={S.row}>
            <View style={{ flex: 1 }}>
              <Text style={S.label}>{t('farmProfile.village')}</Text>
              <TextInput style={S.input} value={form.village} onChangeText={v => u('village', v)} placeholder={t('farmProfile.villagePlaceholder')} placeholderTextColor="#999" />
            </View>
            <View style={{ width: s(100) }}>
              <Text style={S.label}>{t('farmProfile.pincode')}</Text>
              <TextInput style={S.input} value={form.pincode} onChangeText={v => u('pincode', v)} placeholder={t('farmProfile.pincodePlaceholder')} keyboardType="numeric" maxLength={6} placeholderTextColor="#999" />
            </View>
          </View>

          <TouchableOpacity style={S.gpsBtn} onPress={captureGPS}>
            <Ionicons name={form.latitude ? 'checkmark-circle' : 'navigate'} size={16} color={form.latitude ? '#4CAF50' : COLORS.primary} />
            <Text style={S.gpsTxt}>{form.latitude ? `GPS: ${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}` : t('farmProfile.captureGps')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Land & Soil ── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={[S.secIcon, { backgroundColor: '#795548' + '15' }]}><Ionicons name="earth" size={16} color="#795548" /></View>
            <Text style={S.secTitle}>{t('farmProfile.landAndSoil')}</Text>
          </View>

          <Text style={S.label}>{t('farmProfile.landSizeLabel')}</Text>
          <TextInput style={S.landInput} value={form.landSizeAcres} onChangeText={v => u('landSizeAcres', v)} placeholder={t('farmProfile.landSizePlaceholder')} keyboardType="decimal-pad" placeholderTextColor="#999" />

          <Text style={S.label}>{t('farmProfile.soilType')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -s(16) }} contentContainerStyle={{ paddingHorizontal: s(16), gap: s(6) }}>
            {SOILS.map(soil => (
              <TouchableOpacity key={soil.key} style={S.soilCard} onPress={() => u('soilType', soil.key)} activeOpacity={0.8}>
                <LinearGradient colors={soil.bg} style={[S.soilGrad, form.soilType === soil.key && S.soilGradSel]}>
                  {soil.sk ? <SoilIcon type={soil.sk} size={32} /> : <Ionicons name="help" size={24} color="#FFF" />}
                  {form.soilType === soil.key && <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ position: 'absolute', top: 2, right: 2 }} />}
                </LinearGradient>
                <Text style={[S.soilLabel, form.soilType === soil.key && { color: COLORS.primary, fontWeight: '700' }]}>{t(soil.tKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Section 3: Irrigation ── */}
        <View style={S.section}>
          <View style={S.secHeader}>
            <View style={[S.secIcon, { backgroundColor: '#2196F3' + '15' }]}><Ionicons name="water" size={16} color="#2196F3" /></View>
            <Text style={S.secTitle}>{t('farmProfile.irrigationLabel')}</Text>
          </View>

          <View style={S.irrGrid}>
            {IRRS.map(irr => (
              <TouchableOpacity key={irr.key} style={[S.irrCard, form.irrigationSystem === irr.key && { borderColor: irr.color, borderWidth: 2.5 }]} onPress={() => u('irrigationSystem', irr.key)} activeOpacity={0.8}>
                <View style={[S.irrIcon, { backgroundColor: irr.color + '12' }]}>
                  {irr.ik ? <IrrigationIcon type={irr.ik} size={28} /> : <Ionicons name="options" size={22} color={irr.color} />}
                </View>
                <Text style={[S.irrLabel, form.irrigationSystem === irr.key && { color: irr.color, fontWeight: '700' }]}>{t(irr.tKey)}</Text>
                {form.irrigationSystem === irr.key && <Ionicons name="checkmark-circle" size={14} color={irr.color} style={{ position: 'absolute', top: 4, right: 4 }} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: vs(20) }} />
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={S.footer}>
        <TouchableOpacity style={S.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          <LinearGradient colors={[COLORS.cta || '#E65100', '#FF6D00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.saveBtnGrad}>
            <Ionicons name={isEdit ? 'checkmark' : 'add-circle'} size={20} color="#FFF" />
            <Text style={S.saveBtnTxt}>{saving ? t('farmProfile.saving') : isEdit ? t('farmProfile.updateFarm') : t('farmProfile.saveFarm')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: s(14), paddingBottom: vs(10) },

  // Sections
  section: { backgroundColor: '#FFF', borderRadius: 16, padding: s(16), marginBottom: vs(10), elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: vs(10) },
  secIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  secTitle: { fontSize: fs(16), fontWeight: '700', color: '#1A1A1A' },

  // Fields
  label: { fontSize: fs(12), fontWeight: '600', color: '#555', marginTop: vs(10), marginBottom: vs(3) },
  input: { borderWidth: 1.5, borderColor: '#E8E8E8', borderRadius: 12, paddingHorizontal: s(12), paddingVertical: vs(11), fontSize: fs(14), color: '#1A1A1A', backgroundColor: '#FAFAFA' },
  landInput: { borderWidth: 1.5, borderColor: '#E8E8E8', borderRadius: 12, paddingHorizontal: s(14), paddingVertical: vs(12), fontSize: fs(20), fontWeight: '800', color: '#1A1A1A', backgroundColor: '#FAFAFA', textAlign: 'center' },
  row: { flexDirection: 'row', gap: s(10) },

  // GPS
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: vs(12), paddingVertical: vs(10), paddingHorizontal: s(12), borderWidth: 1.5, borderColor: COLORS.primary + '25', borderRadius: 12, borderStyle: 'dashed', backgroundColor: COLORS.primary + '04' },
  gpsTxt: { fontSize: fs(12), color: COLORS.primary, fontWeight: '600' },

  // Soil
  soilCard: { alignItems: 'center', width: s(64) },
  soilGrad: { width: s(56), height: s(56), borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  soilGradSel: { borderColor: '#FFF', elevation: 4 },
  soilLabel: { fontSize: fs(10), color: '#666', marginTop: vs(3), textAlign: 'center' },

  // Irrigation
  irrGrid: { flexDirection: 'row', gap: s(8) },
  irrCard: { flex: 1, backgroundColor: '#FAFAFA', borderRadius: 12, paddingVertical: s(10), alignItems: 'center', borderWidth: 1.5, borderColor: '#E8E8E8', position: 'relative' },
  irrIcon: { width: s(40), height: s(40), borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: vs(4) },
  irrLabel: { fontSize: fs(11), fontWeight: '600', color: '#333' },

  // Footer
  footer: { paddingHorizontal: s(14), paddingTop: vs(8), paddingBottom: vs(24), backgroundColor: '#F5F5F5' },
  saveBtn: { borderRadius: RADIUS.full || 28, overflow: 'hidden' },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), paddingVertical: vs(16) },
  saveBtnTxt: { color: '#FFF', fontSize: fs(16), fontWeight: '700' },
});
