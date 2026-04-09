import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAppointments, saveAppointments, getCustomers } from '../storage/storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function AddEditAppointmentScreen({ route, navigation }) {
  const { appointmentId, customerId: initCustomerId, customerName: initCustomerName } = route.params || {};
  const isEditing = !!appointmentId;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(initCustomerId || '');
  const [selectedCustomerName, setSelectedCustomerName] = useState(initCustomerName || '');
  const [customers, setCustomers] = useState([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Date/time state
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [day, setDay] = useState(String(now.getDate()).padStart(2, '0'));
  const [hour, setHour] = useState(String(now.getHours()).padStart(2, '0'));
  const [minute, setMinute] = useState(String(now.getMinutes()).padStart(2, '0'));

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Rediger aftale' : 'Ny aftale' });
    getCustomers().then(setCustomers);

    if (isEditing) {
      getAppointments().then((all) => {
        const a = all.find((x) => x.id === appointmentId);
        if (a) {
          setTitle(a.title || '');
          setNotes(a.notes || '');
          setSelectedCustomerId(a.customerId || '');
          const d = new Date(a.date);
          setYear(String(d.getFullYear()));
          setMonth(String(d.getMonth() + 1).padStart(2, '0'));
          setDay(String(d.getDate()).padStart(2, '0'));
          setHour(String(d.getHours()).padStart(2, '0'));
          setMinute(String(d.getMinutes()).padStart(2, '0'));
        }
      });
    }
  }, [appointmentId]);

  useEffect(() => {
    if (selectedCustomerId) {
      const c = customers.find((x) => x.id === selectedCustomerId);
      if (c) setSelectedCustomerName(c.name);
    }
  }, [customers, selectedCustomerId]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Mangler titel', 'Aftaletitel er påkrævet.');
      return;
    }
    if (!selectedCustomerId) {
      Alert.alert('Vælg kunde', 'Du skal vælge en kunde til aftalen.');
      return;
    }
    const dateObj = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
    if (isNaN(dateObj.getTime())) {
      Alert.alert('Ugyldig dato', 'Tjek venligst dato og tid.');
      return;
    }

    const all = await getAppointments();
    if (isEditing) {
      const updated = all.map((a) =>
        a.id === appointmentId
          ? { ...a, title, notes, customerId: selectedCustomerId, date: dateObj.toISOString() }
          : a
      );
      await saveAppointments(updated);
    } else {
      const newAppt = {
        id: uuidv4(),
        title,
        notes,
        customerId: selectedCustomerId,
        date: dateObj.toISOString(),
        createdAt: new Date().toISOString(),
      };
      await saveAppointments([...all, newAppt]);
    }
    navigation.goBack();
  };

  const DateTimeInput = ({ label, value, onChangeText, maxLength, placeholder }) => (
    <View style={styles.dtCell}>
      <Text style={styles.dtLabel}>{label}</Text>
      <TextInput
        style={styles.dtInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#D1D5DB"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Title */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Titel *</Text>
          <View style={styles.inputRow}>
            <Ionicons name="calendar-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="F.eks. Møde, Rengøring, Service..."
              placeholderTextColor="#D1D5DB"
            />
          </View>
        </View>

        {/* Customer picker */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Kunde *</Text>
          <TouchableOpacity
            style={styles.inputRow}
            onPress={() => setShowCustomerPicker(true)}
          >
            <Ionicons name="person-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text style={[styles.input, !selectedCustomerName && { color: '#D1D5DB' }]}>
              {selectedCustomerName || 'Vælg kunde...'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Dato</Text>
          <View style={styles.dtRow}>
            <DateTimeInput label="Dag" value={day} onChangeText={setDay} maxLength={2} placeholder="DD" />
            <Text style={styles.dtSep}>/</Text>
            <DateTimeInput label="Måned" value={month} onChangeText={setMonth} maxLength={2} placeholder="MM" />
            <Text style={styles.dtSep}>/</Text>
            <DateTimeInput label="År" value={year} onChangeText={setYear} maxLength={4} placeholder="ÅÅÅÅ" />
          </View>
        </View>

        {/* Time */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Tidspunkt</Text>
          <View style={styles.dtRow}>
            <DateTimeInput label="Time" value={hour} onChangeText={setHour} maxLength={2} placeholder="HH" />
            <Text style={styles.dtSep}>:</Text>
            <DateTimeInput label="Minut" value={minute} onChangeText={setMinute} maxLength={2} placeholder="MM" />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Noter</Text>
          <View style={[styles.inputRow, { alignItems: 'flex-start', paddingVertical: 12 }]}>
            <Ionicons name="document-text-outline" size={18} color="#9CA3AF" style={{ marginRight: 8, marginTop: 2 }} />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Tilføj noter om aftalen..."
              placeholderTextColor="#D1D5DB"
              multiline
              autoCapitalize="sentences"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Ionicons name="checkmark" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.saveBtnText}>{isEditing ? 'Gem ændringer' : 'Opret aftale'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Customer picker modal */}
      <Modal visible={showCustomerPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Vælg kunde</Text>
            <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          {customers.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>Ingen kunder oprettet endnu.</Text>
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerRow}
                  onPress={() => {
                    setSelectedCustomerId(item.id);
                    setSelectedCustomerName(item.name);
                    setShowCustomerPicker(false);
                  }}
                >
                  <View style={styles.customerRowAvatar}>
                    <Text style={styles.customerRowAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.customerRowName}>{item.name}</Text>
                    {item.phone ? <Text style={styles.customerRowSub}>{item.phone}</Text> : null}
                  </View>
                  {selectedCustomerId === item.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#2563EB" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  fieldWrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  dtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dtCell: { alignItems: 'center', flex: 1 },
  dtLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase' },
  dtInput: { fontSize: 20, fontWeight: '600', color: '#111827', textAlign: 'center', paddingVertical: 4 },
  dtSep: { fontSize: 22, color: '#D1D5DB', fontWeight: '300', paddingBottom: 4 },
  saveBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalEmptyText: { color: '#9CA3AF', fontSize: 16 },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  customerRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerRowAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  customerRowName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  customerRowSub: { fontSize: 13, color: '#6B7280' },
});
