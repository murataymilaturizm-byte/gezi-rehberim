import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { AgencyDashboard } from "@/components/dashboard/AgencyDashboard";
import { PlanFeatures } from "@/utils/planFeatures";

interface AdminDashboardProps {
  isSuperAdmin?: boolean;
  planFeatures?: PlanFeatures | null;
  onTabChange?: (tab: string) => void;
  onNewTour?: () => void;
  onBulkImport?: () => void;
  onManualReg?: () => void;
}

export const AdminDashboard = ({
  isSuperAdmin = false,
  planFeatures,
  onTabChange,
  onNewTour,
  onBulkImport,
  onManualReg,
}: AdminDashboardProps) => {
  if (isSuperAdmin) {
    return <SuperAdminDashboard planFeatures={planFeatures} />;
  }

  return (
    <AgencyDashboard
      onTabChange={onTabChange}
      onNewTour={onNewTour}
      onBulkImport={onBulkImport}
      onManualReg={onManualReg}
    />
  );
};
