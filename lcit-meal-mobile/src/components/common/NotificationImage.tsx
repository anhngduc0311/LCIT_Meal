import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useAuth } from '../../providers/AuthProvider';
import { getApiBaseUrl } from '../../services/apiClient';
import { NotificationItem } from '../../types';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export function isNotificationImage(url?: string | null): boolean {
  return Boolean(url?.startsWith('/notification-images/'));
}

export function NotificationImage({ notification }: { notification: NotificationItem }) {
  const { token } = useAuth();
  const [baseUrl, setBaseUrl] = useState('');
  const hasAttachment = isNotificationImage(notification.url);

  useEffect(() => {
    if (!hasAttachment) return;
    let active = true;
    getApiBaseUrl().then(url => {
      if (active) setBaseUrl(url);
    }).catch(() => {});
    return () => { active = false; };
  }, [hasAttachment]);

  const source = notification.imageUri || (hasAttachment && token && baseUrl
    ? { uri: baseUrl + '/notifications/' + notification.id + '/image', headers: { Authorization: 'Bearer ' + token } }
    : null);

  if (!source) return null;
  return (
    <Image
      source={source}
      recyclingKey={String(notification.id)}
      cachePolicy="none"
      contentFit="contain"
      accessibilityLabel="Ảnh đính kèm thông báo"
      style={{ width: '100%', height: 180, marginTop: spacing.sm, borderRadius: radius.md }}
    />
  );
}
