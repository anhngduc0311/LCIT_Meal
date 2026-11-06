import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../../../src/providers/AuthProvider';
import { ScreenContainer, Button } from '../../../src/components/common';
import { LoadingState } from '../../../src/components/states';
import { router } from 'expo-router';

export default function SsoCallbackScreen() {
  const { ssoPending, completeSsoWeb } = useAuth();
  useEffect(() => {
    if (Platform.OS === 'web') completeSsoWeb();
  }, [completeSsoWeb]);
  return (
    <ScreenContainer>
      <LoadingState message={ssoPending ? 'Đang hoàn tất đăng nhập SSO...' : 'Trở về màn hình đăng nhập để tiếp tục.'} />
      {!ssoPending && <Button title="Về đăng nhập" onPress={() => router.replace('/(auth)/login')} />}
    </ScreenContainer>
  );
}
