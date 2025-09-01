import React, {useState} from 'react';
import {View, Text, Pressable, ActivityIndicator} from 'react-native';
import {flags} from '../config/flags';

export default function ConnectivityCheck() {
  const [status, setStatus] = useState<string>('idle');
  const [resp, setResp] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  async function run() {
    if (!flags.confirmApiUrl) {
      setErr('confirmApiUrl not set');
      return;
    }
    setStatus('loading');
    setErr('');
    setResp(null);
    try {
      const r = await fetch(
        flags.confirmApiUrl.replace(/\/$/, '') + '/confirm',
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            id: 'e2e-' + Date.now(),
            cls: 'traffic_light',
            conf: 0.52,
            state: 'amber',
            bbox: [0.46, 0.16, 0.54, 0.34],
            location: {lat: 37.98, lon: 23.72},
            heading: 30,
          }),
        },
      );
      const j = await r.json();
      setResp(j);
      setStatus(r.ok ? 'ok' : 'error');
    } catch (e: any) {
      setErr(String(e?.message || e));
      setStatus('error');
    }
  }

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 12,
        borderRadius: 12,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{color: 'white', fontWeight: '600'}}>
          E2E Cloud Confirm Check
        </Text>
        <Pressable
          onPress={run}
          style={{
            backgroundColor: '#10b981',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
          }}>
          <Text style={{color: 'white', fontWeight: '600'}}>Run Test</Text>
        </Pressable>
      </View>
      <View style={{marginTop: 8}}>
        {status === 'loading' && (
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <ActivityIndicator />
            <Text style={{color: 'white', marginLeft: 8}}>Testing...</Text>
          </View>
        )}
        {status === 'ok' && <Text style={{color: '#a7f3d0'}}>OK ✅</Text>}
        {status === 'error' && (
          <Text style={{color: '#fecaca'}}>Error ❌ {err}</Text>
        )}
        {resp && (
          <Text style={{color: 'white', marginTop: 6}}>
            {JSON.stringify(resp)}
          </Text>
        )}
      </View>
    </View>
  );
}
