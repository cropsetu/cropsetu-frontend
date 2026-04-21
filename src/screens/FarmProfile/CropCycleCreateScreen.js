/**
 * CropCycleCreateScreen — Start a new crop cycle with crop icon picker.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CropIcon from '../../components/CropIcons';
import { useLanguage } from '../../context/LanguageContext';
import { createCropCycle } from '../../services/farmApi';
import { COLORS } from '../../constants/colors';
import { s, vs, fs } from '../../utils/responsive';

const CROP_KEYS = ['soybean', 'cotton', 'rice', 'wheat', 'maize', 'sugarcane', 'onion', 'tomato', 'chilli', 'potato', 'groundnut', 'jowar', 'bajra', 'turmeric', 'pomegranate', 'grape', 'mango', 'banana', 'brinjal', 'okra', 'sunflower'];
const SEASONS = [
  { key: 'KHARIF', tKey: 'crops.kharif', icon: 'rainy', color: '#2196F3' },
  { key: 'RABI', tKey: 'crops.rabi', icon: 'snow', color: '#00BCD4' },
  { key: 'ZAID', tKey: 'crops.zaid', icon: 'sunny', color: '#FF9800' },
];

export default function CropCycleCreateScreen({ navigation, route }) {
  const { t } = useLanguage();
  const { farmId } = route.params;
  const [crop, setCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [season, setSeason] = useState('');
  const [area, setArea] = useState('');
  const [seedBrand, setSeedBrand] = useState('');
  const [seedQty, setSeedQty] = useState('');
  const [seedCost, setSeedCost] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!crop || !season || !area) { Alert.alert(t('farmProfile.requiredTitle'), t('farmProfile.cropCycleRequiredMsg')); return; }
    setSaving(true);
    try {
      await createCropCycle(farmId, {
        cropName: crop, variety, season, year: new Date().getFullYear(),
        areaAllocatedAcres: parseFloat(area),
        seedBrand, seedQuantityKg: seedQty ? parseFloat(seedQty) : null,
        seedTotalCostInr: seedCost ? parseFloat(seedCost) : null,
      });
      navigation.goBack();
    } catch (e) { Alert.alert(t('login.error'), e.message || t('farmProfile.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('farmProfile.startCropCycle')}</Text>

      {/* Crop picker */}
      <Text style={styles.label}>{t('farmProfile.selectCrop')}</Text>
      <View style={styles.cropGrid}>
        {CROP_KEYS.map(k => {
          const label = t('crops.' + k);
          const sel = crop === k;
          return <TouchableOpacity key={k} style={[styles.cropCard, sel && styles.cropCardSel]} onPress={() => setCrop(k)} activeOpacity={0.7}>
            <View style={styles.cropIconWrap}><CropIcon crop={k.charAt(0).toUpperCase() + k.slice(1)} size={40} /></View>
            <Text style={[styles.cropName, sel && { color: COLORS.primary, fontWeight: '700' }]} numberOfLines={1}>{label}</Text>
            {sel && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={{ position: 'absolute', top: 4, right: 4 }} />}
          </TouchableOpacity>;
        })}
      </View>

      {/* Season */}
      <Text style={styles.label}>{t('farmProfile.season')}</Text>
      <View style={styles.seasonRow}>
        {SEASONS.map(s => <TouchableOpacity key={s.key} style={[styles.seasonBtn, season === s.key && { borderColor: s.color, borderWidth: 2 }]} onPress={() => setSeason(s.key)}>
          <Ionicons name={s.icon} size={20} color={s.color} />
          <Text style={styles.seasonText}>{t(s.tKey)}</Text>
        </TouchableOpacity>)}
      </View>

      {/* Area */}
      <Text style={styles.label}>{t('farmProfile.areaAcres')}</Text>
      <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder={t('farmProfile.areaPlaceholder')} keyboardType="decimal-pad" placeholderTextColor="#999" />

      {/* Variety */}
      <Text style={styles.label}>{t('farmProfile.variety')}</Text>
      <TextInput style={styles.input} value={variety} onChangeText={setVariety} placeholder={t('farmProfile.varietyPlaceholder')} placeholderTextColor="#999" />

      {/* Seed info */}
      <Text style={styles.sectionLabel}>{t('farmProfile.seedInfo')}</Text>
      <TextInput style={styles.input} value={seedBrand} onChangeText={setSeedBrand} placeholder={t('farmProfile.seedBrandPlaceholder')} placeholderTextColor="#999" />
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} value={seedQty} onChangeText={setSeedQty} placeholder={t('farmProfile.seedQtyPlaceholder')} keyboardType="decimal-pad" placeholderTextColor="#999" />
        <TextInput style={[styles.input, { flex: 1 }]} value={seedCost} onChangeText={setSeedCost} placeholder={t('farmProfile.seedCostPlaceholder')} keyboardType="numeric" placeholderTextColor="#999" />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? t('farmProfile.saving') : t('farmProfile.startCropCycle')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { padding: s(20), paddingBottom: vs(40) },
  title: { fontSize: fs(22), fontWeight: '800', color: '#1A1A1A', marginBottom: vs(16) },
  label: { fontSize: fs(13), fontWeight: '600', color: '#333', marginTop: vs(14), marginBottom: vs(6) },
  sectionLabel: { fontSize: fs(15), fontWeight: '700', color: '#1A1A1A', marginTop: vs(20), marginBottom: vs(6), borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: vs(14) },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: s(14), paddingVertical: vs(12), fontSize: fs(15), color: '#1A1A1A', backgroundColor: '#FAFAFA', marginBottom: vs(8) },
  row: { flexDirection: 'row', gap: s(10) },
  cropGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(8) },
  cropCard: { width: '22%', backgroundColor: '#FAFAFA', borderRadius: 12, padding: s(8), alignItems: 'center', borderWidth: 1.5, borderColor: '#E8E8E8', position: 'relative' },
  cropCardSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  cropIconWrap: { width: s(44), height: s(44), justifyContent: 'center', alignItems: 'center' },
  cropName: { fontSize: fs(9), color: '#333', textAlign: 'center', marginTop: vs(2) },
  seasonRow: { gap: s(8) },
  seasonBtn: { flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: vs(12), paddingHorizontal: s(14), borderRadius: 12, borderWidth: 1.5, borderColor: '#E8E8E8', marginBottom: vs(6) },
  seasonText: { fontSize: fs(14), color: '#333', fontWeight: '500' },
  saveBtn: { backgroundColor: COLORS.cta, paddingVertical: vs(16), borderRadius: 14, alignItems: 'center', marginTop: vs(20) },
  saveBtnText: { color: '#FFF', fontSize: fs(16), fontWeight: '700' },
});
