import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { AgencyDashboard } from "@/components/dashboard/AgencyDashboard";
import { PlanFeatures } from "@/utils/planFeatures";

interface AdminDashboardProps {
  isSuperAdmin?: boolean;
  planFeatures?: PlanFeatures | null;
}

export const AdminDashboard = ({ isSuperAdmin = false, planFeatures }: AdminDashboardProps) => {
  if (isSuperAdmin) {
    return <SuperAdminDashboard planFeatures={planFeatures} />;
  }

  return <AgencyDashboard />;
};
