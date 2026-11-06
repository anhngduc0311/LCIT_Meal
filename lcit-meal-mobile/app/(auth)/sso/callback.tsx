import React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../../src/providers/AuthProvider';
import { ScreenContainer, Button } from '../../../src/components/common';
import { LoadingState } from '../../../src/components/states';
import { router } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  const { ssoPending } = useAuth();
  return (
    <ScreenContainer>
      <LoadingState message={ssoPending ? 'Đang hoàn tất đăng nhập SSO...' : 'Trở về màn hình đăng nhập để tiếp tục.'} />
      {!ssoPending && <Button title="Về đăng nhập" onPress={() => router.replace('/(auth)/login')} />}
    </ScreenContainer>
  );
}
