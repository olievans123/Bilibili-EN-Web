import { useState, useEffect, useCallback } from 'react';
import {
  getSubscriptions,
  subscribe as subscribeService,
  unsubscribe as unsubscribeService,
  clearSubscriptions as clearSubscriptionsService,
  type Subscription,
} from '../services/subscriptions';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    const items = await getSubscriptions();
    setSubscriptions(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const subscribe = useCallback(async (channel: { mid: number; name: string; face: string }) => {
    await subscribeService(channel);
    setSubscriptions(prev => {
      // Check if already exists
      if (prev.some(sub => sub.mid === channel.mid)) {
        return prev;
      }
      return [{
        mid: channel.mid,
        name: channel.name,
        face: channel.face,
        subscribedAt: Date.now(),
      }, ...prev];
    });
  }, []);

  const unsubscribe = useCallback(async (mid: number) => {
    await unsubscribeService(mid);
    setSubscriptions(prev => prev.filter(sub => sub.mid !== mid));
  }, []);

  const toggleSubscription = useCallback(async (channel: { mid: number; name: string; face: string }) => {
    const isSub = subscriptions.some(sub => sub.mid === channel.mid);
    if (isSub) {
      await unsubscribe(channel.mid);
    } else {
      await subscribe(channel);
    }
  }, [subscriptions, subscribe, unsubscribe]);

  const isSubscribed = useCallback((mid: number) => {
    return subscriptions.some(sub => sub.mid === mid);
  }, [subscriptions]);

  const clearSubscriptions = useCallback(async () => {
    await clearSubscriptionsService();
    setSubscriptions([]);
  }, []);

  return {
    subscriptions,
    loading,
    subscribe,
    unsubscribe,
    toggleSubscription,
    isSubscribed,
    clearSubscriptions,
    refreshSubscriptions: loadSubscriptions,
  };
}
