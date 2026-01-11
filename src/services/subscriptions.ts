import { Store } from '@tauri-apps/plugin-store';

const STORE_PATH = 'subscriptions.json';
const LOCAL_STORAGE_KEY = 'bilibili_subscriptions';
const isTauri = typeof window !== 'undefined'
  && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);

export interface Subscription {
  mid: number;
  name: string;
  face: string;
  subscribedAt: number;
}

let store: Store | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri) return null;
  if (store) return store;
  try {
    store = await Store.load(STORE_PATH);
    return store;
  } catch (error) {
    console.error('Failed to load subscriptions store:', error);
    return null;
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    if (!isTauri) {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Subscription[]) : [];
    }
    const s = await getStore();
    if (!s) return [];
    const subscriptions = await s.get<Subscription[]>('subscriptions');
    return subscriptions || [];
  } catch (error) {
    console.error('Failed to get subscriptions:', error);
    return [];
  }
}

export async function subscribe(channel: { mid: number; name: string; face: string }): Promise<void> {
  try {
    const subscriptions = await getSubscriptions();

    // Check if already subscribed
    if (subscriptions.some(sub => sub.mid === channel.mid)) {
      return;
    }

    const newSub: Subscription = {
      mid: channel.mid,
      name: channel.name,
      face: channel.face,
      subscribedAt: Date.now(),
    };

    subscriptions.unshift(newSub);

    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(subscriptions));
      return;
    }

    const s = await getStore();
    if (!s) return;

    await s.set('subscriptions', subscriptions);
    await s.save();
  } catch (error) {
    console.error('Failed to subscribe:', error);
  }
}

export async function unsubscribe(mid: number): Promise<void> {
  try {
    const subscriptions = await getSubscriptions();
    const filtered = subscriptions.filter(sub => sub.mid !== mid);

    if (!isTauri) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      return;
    }

    const s = await getStore();
    if (!s) return;

    await s.set('subscriptions', filtered);
    await s.save();
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
  }
}

export async function isSubscribed(mid: number): Promise<boolean> {
  try {
    const subscriptions = await getSubscriptions();
    return subscriptions.some(sub => sub.mid === mid);
  } catch {
    return false;
  }
}

export async function clearSubscriptions(): Promise<void> {
  try {
    if (!isTauri) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }
    const s = await getStore();
    if (!s) return;

    await s.set('subscriptions', []);
    await s.save();
  } catch (error) {
    console.error('Failed to clear subscriptions:', error);
  }
}
