import React from "react";
import { ConnectorLayout } from "@/lib/graph";

interface ConnectorProps {
  connector: ConnectorLayout;
  isSelectedBranch: boolean;
  isDimmed: boolean;
}

export const Connector = React.memo(function Connector({
  connector,
  isSelectedBranch,
  isDimmed,
}: ConnectorProps) {
  let strokeColor = "rgba(20, 17, 15, 0.15)";
  let strokeWidth = 1.75;
  let strokeDasharray = "none";
  let opacity = 1;

  if (isSelectedBranch) {
    strokeColor = "var(--color-accent)";
    strokeWidth = 2.5;
  } else if (isDimmed) {
    opacity = 0.25;
  }

  return (
    <g className="transition-opacity duration-200">
      {/* Background glow path when selected */}
      {isSelectedBranch && (
        <path
          d={connector.path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={6}
          strokeOpacity={0.25}
          strokeLinecap="round"
        />
      )}
      <path
        d={connector.path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        opacity={opacity}
      />
    </g>
  );
});
