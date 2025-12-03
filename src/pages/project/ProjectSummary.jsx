/**
 * ProjectSummary Page
 * Main summary view for a project
 */

import ProjectKPIsCards from "../../components/project/ProjectKPIsCards"
import ProjectTimeline from "../../components/project/ProjectTimeline"
import ProjectTeam from "../../components/project/ProjectTeam"
import ProjectAlerts from "../../components/project/ProjectAlerts"
import QuickActions from "../../components/project/QuickActions"

export default function ProjectSummary({ project, onNavigate }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <ProjectKPIsCards project={project} />

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Timeline */}
        <ProjectTimeline project={project} />

        {/* Team */}
        <ProjectTeam project={project} />
      </div>

      {/* Alerts */}
      <ProjectAlerts project={project} />

      {/* Quick Actions */}
      <QuickActions projectId={project?.id} onNavigate={onNavigate} />
    </div>
  )
}
