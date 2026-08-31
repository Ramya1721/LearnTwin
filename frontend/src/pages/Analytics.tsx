import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, LoadingBlock, EmptyState } from "../components/ui";
import { DashboardData } from "../types";

const tooltipStyle = { background: "#151A24", border: "1px solid #28303F", borderRadius: 8, fontSize: 12 };

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/analytics/dashboard")
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <DashboardLayout title="Learning Analytics">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  const pieData = [
    { name: "Theory", value: data.theoryVsPractice.theory, color: "#7C8CFF" },
    { name: "Practice", value: data.theoryVsPractice.practice, color: "#2FE6D0" },
  ];

  return (
    <DashboardLayout title="Learning Analytics" subtitle="Every chart here feeds the bottleneck and correction engines.">
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card title="Skill Radar" eyebrow="Proficiency by skill">
          {data.skillRadar.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={data.skillRadar} outerRadius="75%">
                <PolarGrid stroke="#28303F" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "#8B93A7", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#3A4356", fontSize: 9 }} />
                <Radar dataKey="proficiency" stroke="#2FE6D0" fill="#2FE6D0" fillOpacity={0.25} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No skill data" description="Complete an assessment to populate this chart." />
          )}
        </Card>

        <Card title="Theory vs. Practice" eyebrow="Minutes logged">
          {pieData.some((p) => p.value > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: "#8B93A7" }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No activity logged" description="Log activity in the Practice Hub to see this breakdown." />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Weekly Learning Activity" eyebrow="Last 7 days, minutes">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.weeklyActivity}>
              <XAxis dataKey="day" tick={{ fill: "#8B93A7", fontSize: 12 }} axisLine={{ stroke: "#28303F" }} tickLine={false} />
              <YAxis tick={{ fill: "#8B93A7", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="minutes" fill="#2FE6D0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Assessment Score Trend" eyebrow="Chronological">
          {data.assessmentTrend.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.assessmentTrend.map((a, i) => ({ ...a, idx: i + 1 }))}>
                <XAxis dataKey="skill" tick={{ fill: "#8B93A7", fontSize: 10 }} axisLine={{ stroke: "#28303F" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8B93A7", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="score" stroke="#7C8CFF" strokeWidth={2} dot={{ fill: "#7C8CFF", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No assessment history" description="Take an assessment to start tracking your score trend." />
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
