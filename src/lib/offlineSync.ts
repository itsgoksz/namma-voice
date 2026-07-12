import { Preferences } from "@capacitor/preferences";
import { apiFetch } from "./api";

const QUEUE_KEY = "namma_offline_queue";

export interface OfflineTask {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
}

export async function enqueueOfflineTask(url: string, method: string, body: any) {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  const queue: OfflineTask[] = value ? JSON.parse(value) : [];
  
  const task: OfflineTask = {
    id: Math.random().toString(36).substring(7),
    url,
    method,
    body,
    timestamp: Date.now()
  };
  
  queue.push(task);
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
  console.log(`Enqueued offline task: ${url}`);
}

export async function processOfflineQueue() {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  if (!value) return;
  
  const queue: OfflineTask[] = JSON.parse(value);
  if (queue.length === 0) return;

  try {
    const checkRes = await fetch("http://localhost:8000/feed");
    if (!checkRes.ok) return;
  } catch (e) {
    return;
  }

  const remainingQueue: OfflineTask[] = [];

  for (const task of queue) {
    try {
      await apiFetch(task.url, {
        method: task.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task.body)
      });
      console.log(`Successfully synced task: ${task.id}`);
    } catch (e) {
      console.error(`Failed to sync task: ${task.id}`, e);
      remainingQueue.push(task);
    }
  }

  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(remainingQueue) });
}
