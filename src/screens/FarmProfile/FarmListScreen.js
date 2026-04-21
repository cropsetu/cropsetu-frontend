/**
 * FarmListScreen — All farms with soil-colored cards, crop badges, FAB to add.
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMultiFarm } from '../../context/MultiFarmContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, RADIUS } from '../../constants/colors';
import { s, vs, fs } from '../../utils/responsive';

const SOIL_COLORS = {
  BLACK_COTTON: '#3E3631', RED: '#C45A3C', ALLUVIAL: '#D4A76A', SANDY: '#E8D5A3',
  CLAY_LOAM: '#8B7D6B', SANDY_LOAM: '#B8935A', LATERITE: '#CD7F32', UNKNOWN: '#9E9E9E',
};

export default function FarmListScreen({ navigation }) {
  const { t } = useLanguage();
  const { farms, activeFarmId, switchActiveFarm, refresh, syncing, removeFarm } = useMultiFarm();

  const handleLongPress = (farm) => {
    Alert.alert(farm.farmName || farm.farmAlias, '', [
      { text: 'Set Active', onPress: () => switchActiveFarm(farm.id) },
      { text: 'Edit', onPress: () => navigation.navigate('FarmAddEdit', { farm }) },
      { text: t('delete'), style: 'destructive', onPress: () => Alert.alert(t('farmProfile.deleteTitle'), t('farmProfile.deleteConfirm'), [
        { text: 'Cancel', style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => removeFarm(farm.id) },
      ])},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderFarm = ({ item: farm }) => {
    const isActive = farm.id === activeFarmId;
    const soilColor = SOIL_COLORS[farm.soilType] || '#9E9E9E';
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('FarmDetail', { farmId: farm.id })} onLongPress={() => handleLongPress(farm)} activeOpacity={0.7}>
        <View style={[styles.soilStripe, { backgroundColor: soilColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.farmName}>{farm.farmName || farm.farmAlias || `Farm ${farm.farmNumber}`}</Text>
            {isActive && <View style={styles.activeBadge}><Ionicons name="star" size={10} color="#FFD700" /><Text style={styles.activeText}>{t('farmProfile.active')}</Text></View>}
          </View>
          <Text style={styles.location}>{[farm.village, farm.taluka, farm.district].filter(Boolean).join(', ')}</Text>
          <View style={styles.tags}>
            <Tag label={`${farm.landSizeAcres} ac`} color="#4CAF50" />
            <Tag label={(farm.soilType || '').replace('_', ' ')} color={soilColor} />
            <Tag label={farm.irrigationSystem} color="#2196F3" />
            {farm._count?.cropCycles > 0 && <Tag label={`${farm._count.cropCycles} crops`} color="#FF9800" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={farms}
        keyExtractor={f => f.id}
        renderItem={renderFarm}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>{t('farmProfile.noFarms') || 'No Farms Yet'}</Text>
            <Text style={styles.emptyText}>{t('farmProfile.addFirstFarm') || 'Add your first farm to get personalized AI recommendations'}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('FarmAddEdit')}>
              <Text style={styles.emptyBtnText}>+ Add Farm</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('FarmAddEdit')} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

function Tag({ label, color }) {
  if (!label) return null;
  return <View style={[styles.tag, { backgroundColor: color + '15' }]}><Text style={[styles.tagText, { color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  list: { padding: s(14), paddingBottom: vs(80) },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14, marginBottom: vs(10), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, overflow: 'hidden' },
  soilStripe: { width: s(6) },
  cardBody: { flex: 1, padding: s(14) },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  farmName: { fontSize: fs(16), fontWeight: '700', color: '#1A1A1A', flex: 1 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: '#FFF8E1', paddingHorizontal: s(8), paddingVertical: vs(2), borderRadius: 10 },
  activeText: { fontSize: fs(10), fontWeight: '700', color: '#F57F17' },
  location: { fontSize: fs(12), color: '#666', marginTop: vs(3) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6), marginTop: vs(8) },
  tag: { paddingHorizontal: s(8), paddingVertical: vs(3), borderRadius: 8 },
  tagText: { fontSize: fs(11), fontWeight: '600', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingTop: vs(80), paddingHorizontal: s(40) },
  emptyTitle: { fontSize: fs(18), fontWeight: '700', color: '#333', marginTop: vs(16) },
  emptyText: { fontSize: fs(13), color: '#999', textAlign: 'center', marginTop: vs(8), lineHeight: fs(19) },
  emptyBtn: { marginTop: vs(20), backgroundColor: COLORS.cta, paddingHorizontal: s(24), paddingVertical: vs(12), borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontSize: fs(15), fontWeight: '700' },
  fab: { position: 'absolute', bottom: vs(24), right: s(20), width: s(56), height: s(56), borderRadius: 28, backgroundColor: COLORS.cta, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
