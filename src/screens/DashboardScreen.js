import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomers, getAppointments } from '../storage/storage';

export default function DashboardScreen({ navigation }) {
  const [customerCount, setCustomerCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [customers, appointments] = await Promise.all([getCustomers(), getAppointments()]);
        setCustomerCount(customers.length);

        const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86400000);

        const enriched = appointments.map((a) => ({
          ...a,
          customerName: customerMap[a.customerId] || 'Ukendt',
        }));

        const today = enriched
          .filter((a) => {
            const d = new Date(a.date);
            return d >= todayStart && d < todayEnd;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const upcoming = enriched
          .filter((a) => new Date(a.date) >= now)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 5);

        setTodayAppointments(today);
        setUpcomingAppointments(upcoming);
      };
      load();
    }, [])
  );

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>God dag!</Text>
        <Text style={styles.subGreeting}>Her er et overblik over din dag</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}
          onPress={() => navigation.navigate('Kunder')}
        >
          <Ionicons name="people" size={28} color="#2563EB" />
          <Text style={styles.statNumber}>{customerCount}</Text>
          <Text style={styles.statLabel}>Kunder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}
          onPress={() => navigation.navigate('Aftaler')}
        >
          <Ionicons name="calendar" size={28} color="#10B981" />
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{upcomingAppointments.length}</Text>
          <Text style={styles.statLabel}>Kommende</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}
          onPress={() => navigation.navigate('Aftaler')}
        >
          <Ionicons name="today" size={28} color="#F59E0B" />
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{todayAppointments.length}</Text>
          <Text style={styles.statLabel}>I dag</Text>
        </TouchableOpacity>
      </View>

      {/* Today */}
      {todayAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I dag</Text>
          {todayAppointments.map((a) => (
            <View key={a.id} style={[styles.apptCard, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.apptTime}>{formatTime(a.date)}</Text>
              <View style={styles.apptInfo}>
                <Text style={styles.apptTitle}>{a.title}</Text>
                <Text style={styles.apptCustomer}>{a.customerName}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming */}
      {upcomingAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Næste aftaler</Text>
          {upcomingAppointments.map((a) => (
            <View key={a.id} style={styles.apptCard}>
              <Text style={styles.apptTime}>{formatDate(a.date)}</Text>
              <View style={styles.apptInfo}>
                <Text style={styles.apptTitle}>{a.title}</Text>
                <Text style={styles.apptCustomer}>{a.customerName}</Text>
              </View>
              <Text style={styles.apptTimeRight}>{formatTime(a.date)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hurtige handlinger</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Kunder', { screen: 'AddEditCustomer', params: {} })}
          >
            <Ionicons name="person-add" size={24} color="#2563EB" />
            <Text style={styles.actionLabel}>Ny kunde</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Aftaler', { screen: 'AddEditAppointment', params: {} })}
          >
            <Ionicons name="calendar-outline" size={24} color="#10B981" />
            <Text style={styles.actionLabel}>Ny aftale</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#2563EB',
    padding: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },
  greeting: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#2563EB', marginTop: 6 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  apptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
    paddingLeft: 10,
    marginBottom: 4,
    borderRadius: 4,
  },
  apptTime: { fontSize: 12, color: '#6B7280', width: 60, fontWeight: '500' },
  apptInfo: { flex: 1 },
  apptTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  apptCustomer: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  apptTimeRight: { fontSize: 13, color: '#9CA3AF' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 6 },
});
