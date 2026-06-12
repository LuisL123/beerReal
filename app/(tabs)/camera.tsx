import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
  ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/colors';

const DRINK_TYPES = ['Beer', 'IPA', 'Stout', 'Lager', 'Ale', 'Wine', 'Cocktail', 'Other'];
const { width: SW } = Dimensions.get('window');
const MAX_EXTRA = 5;

type State = 'camera' | 'preview' | 'uploading';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [state, setState] = useState<State>('camera');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [drinkType, setDrinkType] = useState('Beer');
  const [extraCount, setExtraCount] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permBox}>
          <Text style={styles.permEmoji}>📸</Text>
          <Text style={styles.permTitle}>Camera needed</Text>
          <Text style={styles.permSub}>We need your camera to capture your drinks</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const snap = async () => {
    if (!cameraRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo) setPhotoUris(prev => [...prev, photo.uri]);
  };

  const retake = () => {
    setPhotoUris([]);
    setCaption('');
    setDrinkType('Beer');
    setExtraCount(0);
    setState('camera');
  };

  const post = async () => {
    if (photoUris.length === 0) return;
    setState('uploading');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ts = Date.now();
      const uploadedUrls: string[] = [];

      for (let i = 0; i < photoUris.length; i++) {
        const path = `${user.id}/${ts}-${i}.jpg`;
        const bytes = await new ExpoFile(photoUris[i]).arrayBuffer();
        const { error: uploadErr } = await supabase.storage
          .from('posts')
          .upload(path, bytes, { contentType: 'image/jpeg' });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
        uploadedUrls.push(publicUrl);
      }

      const [primaryUrl, ...restUrls] = uploadedUrls;

      const { error: postErr } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: primaryUrl,
        image_urls: restUrls,
        photo_count: photoUris.length,
        extra_count: extraCount,
        caption: caption.trim() || null,
        drink_type: drinkType,
      });
      if (postErr) throw postErr;

      const { error: rpcErr } = await supabase.rpc('increment_beer_counts', {
        uid: user.id,
        photo_n: photoUris.length,
        extra_n: extraCount,
      });
      if (rpcErr) throw rpcErr;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      retake();
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Failed to post', err.message);
      setState('preview');
    }
  };

  if (state === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
        <SafeAreaView style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View style={styles.topRow}>
            <Text style={styles.camTitle}>Cheers 🍺</Text>
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.bottomRow}>
            {photoUris.length > 0 && (
              <TouchableOpacity style={styles.doneBtn} onPress={() => setState('preview')} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>
                  Use {photoUris.length} {photoUris.length === 1 ? 'photo' : 'photos'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.shutterWrap}>
              <TouchableOpacity style={styles.shutter} onPress={snap} activeOpacity={0.8}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              {photoUris.length > 0 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>{photoUris.length}</Text>
                </View>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state === 'uploading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.uploadingText}>Posting your drink...</Text>
      </View>
    );
  }

  // preview
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={retake}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>New Post</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: SW }}
          >
            {photoUris.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.previewImg} resizeMode="cover" />
            ))}
          </ScrollView>
          {photoUris.length > 1 && (
            <View style={styles.dotsRow}>
              {photoUris.map((_, idx) => (
                <View key={idx} style={styles.dot} />
              ))}
            </View>
          )}

          <View style={styles.formArea}>
            <TextInput
              style={styles.captionInput}
              placeholder="What are you drinking? 🍺"
              placeholderTextColor={COLORS.textMuted}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
            />

            <Text style={styles.drinkLabel}>Drink type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DRINK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, drinkType === type && styles.chipActive]}
                  onPress={() => setDrinkType(type)}
                >
                  <Text style={[styles.chipText, drinkType === type && styles.chipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.extraContainer}>
              <Text style={styles.extraLabel}>Extra beers (unverified)</Text>
              <Text style={styles.extraSub}>Beers you drank but didn't photograph</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepperBtn, extraCount === 0 && styles.stepperBtnDisabled]}
                  onPress={() => setExtraCount(c => Math.max(0, c - 1))}
                  disabled={extraCount === 0}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{extraCount}</Text>
                <TouchableOpacity
                  style={[styles.stepperBtn, extraCount === MAX_EXTRA && styles.stepperBtnDisabled]}
                  onPress={() => setExtraCount(c => Math.min(MAX_EXTRA, c + 1))}
                  disabled={extraCount === MAX_EXTRA}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.postBtn} onPress={post} activeOpacity={0.8}>
              <Text style={styles.postBtnText}>🍺  Post it!</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4,
  },
  camTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  flipBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  bottomRow: { paddingBottom: 36, alignItems: 'center', gap: 16 },
  doneBtn: {
    backgroundColor: COLORS.primary, borderRadius: 22,
    paddingVertical: 10, paddingHorizontal: 28,
  },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  shutterWrap: { position: 'relative' },
  shutter: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.primary },
  photoCountBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: COLORS.primary, borderRadius: 11,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  photoCountText: { color: '#000', fontSize: 11, fontWeight: '900' },
  uploadingText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 16 },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  previewTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  previewImg: { width: SW, height: SW, backgroundColor: COLORS.surface },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  formArea: { padding: 20, gap: 16 },
  captionInput: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, color: COLORS.text, fontSize: 15,
    minHeight: 80, textAlignVertical: 'top',
  },
  drinkLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#000', fontWeight: '700' },
  extraContainer: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  extraLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 2 },
  extraSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepperBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { color: COLORS.text, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  stepperVal: { fontSize: 22, fontWeight: '800', color: COLORS.textSecondary, minWidth: 28, textAlign: 'center' },
  postBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  postBtnText: { color: '#000', fontSize: 17, fontWeight: '900' },
  permBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  permEmoji: { fontSize: 60, marginBottom: 20 },
  permTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  permSub: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 },
  permBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
