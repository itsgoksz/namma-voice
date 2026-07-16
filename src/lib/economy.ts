// Economy system for Eco Credits
// Since we don't have backend migrations for the MVP, we derive total credits from the user's level
// and track purchases / spent credits in localStorage.

import { getCurrentUser } from "./api";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'aura' | 'booster' | 'title' | 'theme';
  icon: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'aura_gold', name: 'Golden Guardian Aura', description: 'Surround your map marker in a radiant golden glow.', price: 50, type: 'aura', icon: '✨' },
  { id: 'aura_cyber', name: 'Cyber Neon Trail', description: 'Leave a glitching neon trail on the community feed.', price: 80, type: 'aura', icon: '⚡' },
  { id: 'title_terminator', name: 'Title: The Trash Terminator', description: 'Equip this exclusive title on the leaderboard.', price: 30, type: 'title', icon: '🤖' },
  { id: 'title_sovereign', name: 'Title: Eco Sovereign', description: 'Show everyone who really runs this city.', price: 100, type: 'title', icon: '👑' },
  { id: 'boost_xp', name: '24Hr XP Booster', description: 'Earn 1.5x XP for all cleanup actions for 24 hours.', price: 20, type: 'booster', icon: '🚀' },
];

export const getEcoCredits = (currentLevel: number): { totalEarned: number; spent: number; balance: number } => {
  const user = getCurrentUser();
  if (!user) return { totalEarned: 0, spent: 0, balance: 0 };

  // 10 credits awarded per level up (starting from level 1)
  const totalEarned = Math.max(0, (currentLevel - 1) * 10);
  
  // Get spent credits from local storage
  const spentKey = `littr_spent_credits_${user}`;
  const spent = parseInt(localStorage.getItem(spentKey) || '0', 10);

  return {
    totalEarned,
    spent,
    balance: Math.max(0, totalEarned - spent)
  };
};

export const purchaseItem = (currentLevel: number, item: ShopItem): boolean => {
  const user = getCurrentUser();
  if (!user) return false;

  const { balance } = getEcoCredits(currentLevel);
  
  if (balance >= item.price) {
    // Deduct credits
    const spentKey = `littr_spent_credits_${user}`;
    const currentSpent = parseInt(localStorage.getItem(spentKey) || '0', 10);
    localStorage.setItem(spentKey, (currentSpent + item.price).toString());

    // Add to inventory
    const inventoryKey = `littr_inventory_${user}`;
    const inventory = JSON.parse(localStorage.getItem(inventoryKey) || '[]');
    if (!inventory.includes(item.id)) {
      inventory.push(item.id);
      localStorage.setItem(inventoryKey, JSON.stringify(inventory));
    }
    return true;
  }
  
  return false;
};

export const getInventory = (): string[] => {
  const user = getCurrentUser();
  if (!user) return [];
  const inventoryKey = `littr_inventory_${user}`;
  return JSON.parse(localStorage.getItem(inventoryKey) || '[]');
};
