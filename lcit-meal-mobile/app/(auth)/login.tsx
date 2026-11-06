/**
 * Auth Screen - Đăng nhập (Login)
 * Giao diện đăng nhập với tài khoản/mật khẩu, hỗ trợ chọn nhanh tài khoản thử nghiệm
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { Input } from '../../src/components/common/Input';
import { PasswordInput } from '../../src/components/common/PasswordInput';
import { Button } from '../../src/components/common/Button';
import { ResultBanner } from '../../src/components/common/ResultBanner';
import { Card } from '../../src/components/common/Card';
import { useAuth } from '../../src/providers/AuthProvider';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';
import { prepareSso, PreparedSso } from '../../src/services/ssoService';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginSso, ssoPending, ssoError, useMockData } = useAuth();
  const { wide, compact } = useResponsiveLayout();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoPrepared, setSsoPrepared] = useState<PreparedSso | null>(null);
  const [preparingSso, setPreparingSso] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const refreshSso = useCallback(async () => {
    if (useMockData) return;
    setPreparingSso(true);
    setSsoPrepared(null);
    setPrepareError(null);
    try { setSsoPrepared(await prepareSso()); }
    catch (error) { setPrepareError(error instanceof Error ? error.message : 'Không kết nối được SSO.'); }
    finally { setPreparingSso(false); }
  }, [useMockData]);
  useEffect(() => {
    refreshSso();
    const timer = setInterval(refreshSso, 9 * 60 * 1000);
    return () => clearInterval(timer);
  }, [refreshSso]);
  const handleSso = async () => {
    if (loading || ssoPending || preparingSso) return;
    setErrorMessage(null);
    if (!ssoPrepared) { await refreshSso(); return; }
    const prepared = ssoPrepared;
    setSsoPrepared(null);
    await loginSso(prepared);
    await refreshSso();
  };
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const isKeyboardActive = isKeyboardVisible || focusedField !== null;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setFocusedField(null);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleFocus = (field: 'username' | 'password') => {
    setFocusedField(field);
    setIsKeyboardVisible(true);
    if (!wide && Platform.OS !== 'web') {
      setTimeout(() => {
        const offset = field === 'username' ? 40 : 120;
        scrollRef.current?.scrollTo({ y: offset, animated: true });
      }, 80);
    }
  };

  const handleBlur = (field: 'username' | 'password') => {
    setFocusedField((prev) => (prev === field ? null : prev));
  };


  const handleLogin = async () => {
    if (loading || ssoPending) return;
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
    setFocusedField(null);
    setIsKeyboardVisible(false);

    if (!username.trim()) {
      setErrorMessage('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login({ username: username.trim(), password });
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <View style={[styles.container, wide && styles.desktop]}>
      {/* Brand Logo & Title */}
      <View
        style={[
          styles.brandHeader,
          wide && styles.brandDesktop,
          !wide && isKeyboardActive && styles.brandHeaderCompact,
        ]}
      >
        {!wide && isKeyboardActive ? (
          <View style={styles.brandRowCompact}>
            <View style={styles.logoCircleSmall}>
              <Ionicons name="restaurant" size={18} color="#DCEAA0" />
            </View>
            <View>
              <Text style={styles.appNameSmall}>LCIT MEAL</Text>
              <Text style={styles.appTaglineSmall}>BỮA TRƯA TẠI CƠ QUAN</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.logoCircle}>
              <Ionicons name="restaurant" size={wide ? 30 : 26} color="#DCEAA0" />
            </View>
            <Text style={styles.appName}>LCIT MEAL</Text>
            <Text style={styles.appTagline}>BỮA TRƯA TẠI CƠ QUAN</Text>
            <Text style={[styles.brandHeadline, wide && { fontSize: 42, lineHeight: 54 }]}>
              Một bữa ăn tốt.{'\n'}Một ngày hiệu quả.
            </Text>
            <Text style={styles.brandDescription}>
              Đăng ký bữa trưa, theo dõi lịch ăn và thanh toán trong cùng một nơi.
            </Text>
            {wide && (
              <View style={styles.brandArtwork}>
                <Ionicons name="leaf-outline" size={80} color="#DCEAA0" />
                <Text style={styles.artworkCaption}>CHĂM CHÚT TỪNG BỮA ĂN</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.formColumn}>
        {/* Form Đăng nhập */}
        <Card
          variant="elevated"
          padding={compact || (!wide && isKeyboardActive) ? 'lg' : '2xl'}
          style={styles.formCard}
        >
          <Text style={styles.formEyebrow}>CHÀO MỪNG TRỞ LẠI</Text>
          <Text style={[styles.formTitle, !wide && isKeyboardActive && styles.formTitleCompact]}>
            Đăng nhập
          </Text>
          {(!isKeyboardActive || wide) && (
            <Text style={styles.formSubtitle}>
              Sử dụng tài khoản được cơ quan cấp để tiếp tục
            </Text>
          )}

          {(errorMessage || ssoError) && (
            <ResultBanner
              variant="error"
              message={errorMessage || ssoError || ''}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          <Input
            label="Tên đăng nhập"
            placeholder="Nhập tên đăng nhập"
            value={username}
            onChangeText={(txt) => {
              setUsername(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
            onFocus={() => handleFocus('username')}
            onBlur={() => handleBlur('username')}
            leftIcon={
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textSecondary}
              />
            }
          />

          <PasswordInput
            ref={passwordInputRef}
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            value={password}
            onChangeText={(txt) => {
              setPassword(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            onFocus={() => handleFocus('password')}
            onBlur={() => handleBlur('password')}
            leftIcon={
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textSecondary}
              />
            }
          />

          <Button
            title="Đăng nhập"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={ssoPending}
            onPress={handleLogin}
            fullWidth
            style={styles.loginBtn}
          />

          <Button
            title={ssoPending ? 'Đang đăng nhập SSO...' : 'Đăng nhập với SSO'}
            variant="outline"
            size="lg"
            loading={ssoPending || preparingSso}
            disabled={loading || useMockData}
            onPress={handleSso}
            fullWidth
          />
          {prepareError && <Text style={styles.footer}>{prepareError} Bấm SSO để thử lại.</Text>}

        </Card>

        <Text style={styles.footer}>LCIT MEAL · Quản lý suất ăn cơ quan</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer
      scrollable
      scrollRef={scrollRef}
      backgroundColor={colors.background}
      contentContainerStyle={!wide && isKeyboardActive ? styles.scrollContentKeyboard : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {Platform.OS === 'web' ? (
        formBody
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {formBody}
        </TouchableWithoutFeedback>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktop: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 40 },
  brandDesktop: { flex: 1, padding: 36 },
  formColumn: { flex: 1, minWidth: 0 },
  brandHeadline: { fontSize: 22, lineHeight: 30, color: '#FFFFFF', fontWeight: '800', marginTop: 14, letterSpacing: -0.6 },
  brandDescription: { fontSize: 13, lineHeight: 20, color: '#D5E4D8', marginTop: 8, maxWidth: 320 },
  brandArtwork: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  artworkCaption: { fontSize: 10, letterSpacing: 2, fontWeight: '700', color: '#DCEAA0' },
  formEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, color: colors.primary, marginBottom: 8 },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: 16, fontWeight: '500' },
  container: {
    paddingVertical: spacing.lg,
    gap: 20,
  },
  brandHeader: {
    padding: 20,
    backgroundColor: colors.primaryDark,
    borderRadius: radius['2xl'],
  },
  brandHeaderCompact: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    marginBottom: 0,
  },
  brandRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: '#164839',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2F6B58',
  },
  appNameSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  appTaglineSmall: {
    fontSize: 8,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#B2D8C6',
    marginTop: 2,
  },
  scrollContentKeyboard: {
    paddingBottom: Platform.OS === 'android' ? 240 : 160,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: '#164839',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#2F6B58',
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: '#B2D8C6',
    marginTop: 4,
  },
  formCard: {
    width: '100%',
    marginBottom: spacing.md,
    borderRadius: radius['2xl'],
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  formTitleCompact: {
    fontSize: 22,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  loginBtn: {
    marginTop: spacing.md,
  },
});
