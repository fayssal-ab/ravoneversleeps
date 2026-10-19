// VIP benefits as published by Qzino on https://qzino.com/en/vip-club
// (checked 2026-10-19). Only listed benefits; rates are "up to" and depend
// on Qzino's VIP level. Update here if Qzino changes its page.

export const VIP_SOURCE = "https://qzino.com/en/vip-club";

export type BenefitIcon = "cashback" | "rakeback" | "manager" | "gift" | "crown" | "cake" | "wheel" | "calendar";

export const VIP_BENEFITS: { icon: BenefitIcon; title: string; value?: string; body: string }[] = [
  { icon: "cashback", title: "Cashback", value: "up to 40%", body: "Part of your losses back, twice a week." },
  { icon: "rakeback", title: "Rakeback", value: "up to 15%", body: "A bonus every 30 minutes, with a Rakeback boost." },
  { icon: "manager", title: "Personal VIP manager", body: "A dedicated manager for tailored bonuses, offers and priority help." },
  { icon: "gift", title: "Personal VIP bonuses", body: "Individual bonuses from your VIP manager." },
  { icon: "crown", title: "VIP welcome bonus", body: "A bonus for joining the VIP club, tailored to your profile." },
  { icon: "calendar", title: "VIP royalty bonus", body: "A weekly bonus based on your activity." },
  { icon: "cake", title: "VIP birthday bonus", body: "A bonus on your birthday." },
  { icon: "wheel", title: "Gold Wheel", value: "up to $300k", body: "Spin the VIP Gold Wheel for prizes in BTC." },
];
