import type { AnalyticsProvider, Period, MetricResult } from "./provider";

function seedFromDate(): number {
  const now = new Date();
  return now.getDate() + now.getHours();
}

function plausibleMetric(base: number, variance: number = 0.2): MetricResult {
  const seed = seedFromDate();
  const noise = ((seed * 7) % 100) / 100;
  const value = Math.round(base * (1 + (noise - 0.5) * variance * 2));
  const delta = Math.round(((seed * 3) % 30) - 15);
  return {
    value,
    trend: {
      delta,
      direction: delta > 2 ? "up" : delta < -2 ? "down" : "flat",
    },
  };
}

function scaleByPeriod(base: number, period: Period): number {
  switch (period) {
    case "today":
      return base;
    case "week":
      return base * 7;
    case "month":
      return base * 30;
    case "year":
      return base * 365;
  }
}

export const mockAnalytics: AnalyticsProvider = {
  async getVisits(period) {
    return plausibleMetric(scaleByPeriod(70, period));
  },
  async getWhatsAppClicks(period) {
    return plausibleMetric(scaleByPeriod(8, period));
  },
  async getFormSubmissions(period) {
    return plausibleMetric(scaleByPeriod(2, period));
  },
  async getActiveConversations(period) {
    return plausibleMetric(scaleByPeriod(12, period));
  },
  async getReservations(period) {
    return plausibleMetric(scaleByPeriod(1, period));
  },
  async getPostsPublished(period) {
    return plausibleMetric(scaleByPeriod(0.3, period));
  },
};
