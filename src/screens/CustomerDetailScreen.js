import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCustomers, getAppointments } from '../storage/storage';

export default function CustomerDetailScreen({ route, navigation }) {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState(null);
  const [appointments, setAppointments] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getCustomers().then((all) => {
        const c = all.find((x) => x.id === customerId);
        setCustomer(c);
        if (c) navigation.setOptions({ title: c.name });
      });
      getAppointments().then((all) => {
        const mine = all
          .filter((a) => a.customerId === customerId)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        setAppointments(mine);
      });
    }, [customerId])
  );

  if (!customer) return null;

  const upcoming = appointments.filter((a) => new Date(a.date) >= new Date());
  const past = appointments.filter((a) => new Date(a.date) < new Date());

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('da-DK', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const AppointmentCard = ({ item, isPast }) => (
    <View style={[styles.apptCard, isPast && styles.apptPast]}>
      <Ionicons
        name={isPast ? 'checkmark-circle' : 'time-outline'}
        size={20}
        color={isPast ? '#10B981' : '#2563EB'}
        style={{ marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.apptTitle}>{item.title}</Text>
        <Text style={styles.apptDate}>{formatDate(item.date)}</Text>
        {item.notes ? <Text style={styles.apptNotes}>{item.notes}</Text> : null}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.headerName}>{customer.name}</Text>
        {customer.company ? (
          <Text style={styles.headerCompany}>{customer.company}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('AddEditCustomer', { customerId })}
        >
          <Ionicons name="pencil" size={16} color="#fff" />
          <Text style={styles.editBtnText}>Rediger</Text>
        </TouchableOpacity>
      </View>

      {/* Contact info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kontaktoplysninger</Text>
        {customer.phone ? (
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(`tel:${customer.phone}`)}
          >
            <Ionicons name="call-outline" size={20} color="#2563EB" style={styles.rowIcon} />
            <Text style={styles.rowText}>{customer.phone}</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        ) : null}
        {customer.email ? (
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(`mailto:${customer.email}`)}
          >
            <Ionicons name="mail-outline" size={20} color="#2563EB" style={styles.rowIcon} />
            <Text style={styles.rowText}>{customer.email}</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        ) : null}
        {customer.address ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color="#2563EB" style={styles.rowIcon} />
            <Text style={styles.rowText}>{customer.address}</Text>
          </View>
        ) : null}
        {!customer.phone && !customer.email && !customer.address && (
          <Text style={styles.noData}>Ingen kontaktoplysninger</Text>
        )}
      </View>

      {/* Notes */}
      {customer.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Noter</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{customer.notes}</Text>
          </View>
        </View>
      ) : null}

      {/* Appointments */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kommende aftaler</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('AddEditAppointment', { customerId, customerName: customer.name })
            }
          >
            <Ionicons name="add-circle" size={26} color="#2563EB" />
          </TouchableOpacity>
        </View>
        {upcoming.length === 0 ? (
          <Text style={styles.noData}>Ingen kommende aftaler</Text>
        ) : (
          upcoming.map((a) => <AppointmentCard key={a.id} item={a} isPast={false} />)
        )}
      </View>

      {past.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tidligere aftaler</Text>
          {past.map((a) => (
            <AppointmentCard key={a.id} item={a} isPast={true} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#2563EB',
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  headerName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerCompany: { color: 'rgba(255,255,255,0.75)', fontSize: 15, marginTop: 4 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
  },
  editBtnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowIcon: { marginRight: 12 },
  rowText: { flex: 1, fontSize: 15, color: '#374151' },
  noData: { color: '#9CA3AF', fontSize: 14, fontStyle: 'italic' },
  notesBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  notesText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  apptCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  apptPast: { backgroundColor: '#F0FDF4' },
  apptTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  apptDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  apptNotes: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
