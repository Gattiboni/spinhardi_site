export type Period = "today" | "week" | "month" | "year";

export type MetricResult = {
  value: number;
  trend?: {
    delta: number;
    direction: "up" | "down" | "flat";
  };
};

export type AnalyticsProvider = {
  getVisits(period: Period): Promise<MetricResult>;
  getWhatsAppClicks(period: Period): Promise<MetricResult>;
  getFormSubmissions(period: Period): Promise<MetricResult>;
  getActiveConversations(period: Period): Promise<MetricResult>;
  getReservations(period: Period): Promise<MetricResult>;
  getPostsPublished(period: Period): Promise<MetricResult>;
};
