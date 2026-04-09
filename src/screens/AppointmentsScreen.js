import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SectionList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAppointments, saveAppointments, getCustomers } from '../storage/storage';

export default function AppointmentsScreen({ navigation }) {
  const [sections, setSections] = useState([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    const [appts, customers] = await Promise.all([getAppointments(), getCustomers()]);
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));

    const enriched = appts.map((a) => ({
      ...a,
      customerName: customerMap[a.customerId] || 'Ukendt kunde',
    }));

    const now = new Date();
    const upcoming = enriched
      .filter((a) => new Date(a.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const past = enriched
      .filter((a) => new Date(a.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const result = [];
    if (upcoming.length > 0) result.push({ title: 'Kommende', data: upcoming });
    if (past.length > 0) result.push({ title: 'Tidligere', data: past });
    setSections(result);
  };

  const deleteAppointment = (id) => {
    Alert.alert('Slet aftale', 'Er du sikker?', [
      { text: 'Annuller', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          const all = await getAppointments();
          await saveAppointments(all.filter((a) => a.id !== id));
          load();
        },
      },
    ]);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('da-DK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item, section }) => {
    const isPast = section.title === 'Tidligere';
    return (
      <TouchableOpacity
        style={[styles.card, isPast && styles.cardPast]}
        onPress={() =>
          navigation.navigate('AddEditAppointment', {
            appointmentId: item.id,
            customerId: item.customerId,
            customerName: item.customerName,
          })
        }
        activeOpacity={0.7}
      >
        <View style={[styles.dateBox, isPast && styles.dateBoxPast]}>
          <Text style={[styles.dateDay, isPast && styles.dateDayPast]}>
            {new Date(item.date).getDate()}
          </Text>
          <Text style={[styles.dateMonth, isPast && styles.dateMonthPast]}>
            {new Date(item.date).toLocaleDateString('da-DK', { month: 'short' })}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardCustomer}>
            <Ionicons name="person-outline" size={12} /> {item.customerName}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
          {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => deleteAppointment(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const hasData = sections.length > 0;

  return (
    <View style={styles.container}>
      {!hasData ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>Ingen aftaler endnu</Text>
          <Text style={styles.emptySubText}>Tryk på + for at oprette en aftale</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditAppointment', {})}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPast: { opacity: 0.7 },
  dateBox: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateBoxPast: { backgroundColor: '#F3F4F6' },
  dateDay: { fontSize: 22, fontWeight: '700', color: '#2563EB', lineHeight: 26 },
  dateDayPast: { color: '#9CA3AF' },
  dateMonth: { fontSize: 11, fontWeight: '600', color: '#2563EB', textTransform: 'uppercase' },
  dateMonthPast: { color: '#9CA3AF' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardCustomer: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cardNotes: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  deleteBtn: { padding: 6 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#9CA3AF', marginTop: 16, fontWeight: '500' },
  emptySubText: { fontSize: 14, color: '#D1D5DB', marginTop: 8 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
