"use client";

interface StatCard {
  value: string | number;
  subtitle: string;
  color: string;
}

function Card({ value, subtitle, color }: StatCard) {
  return (
    <div style={{
      background: "#F8F8F8",
      borderRadius: 6,
      padding: 12,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#777", marginTop: 3 }}>
        {subtitle}
      </div>
    </div>
  );
}

interface Props {
  coverageHours: number;   // total employee-hours this week (hours × days × employees on shift)
  aloneCount: number;      // period×day slots with exactly 1 employee
  gapCount: number;        // period×day slots with 0 employees
  activeCount: number;     // unique employees with ≥1 shift this week
}

export default function StatStrip({ coverageHours, aloneCount, gapCount, activeCount }: Props) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 10,
    }}>
      <Card value={`${coverageHours}ש'`} subtitle="שעות כיסוי"    color="#5B8C3E" />
      <Card value={aloneCount}           subtitle='משמרות "לבד"'  color="#D89030" />
      <Card value={gapCount}             subtitle="ללא איוש"       color="#C9453F" />
      <Card value={activeCount}          subtitle="עובדות פעילות"  color="#2D2D2D" />
    </div>
  );
}
