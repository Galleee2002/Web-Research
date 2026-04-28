import type { LeadStatus } from "@shared/index";

export function leadStatusLabel(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "reviewed":
      return "Reviewed";
    case "contacted":
      return "Contacted";
    case "discarded":
      return "Discarded";
    default:
      return status;
  }
}
