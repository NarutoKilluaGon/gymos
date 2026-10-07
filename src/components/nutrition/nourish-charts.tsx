import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { N } from "@/constants/nourish-theme";
import type { SeriesPoint } from "@/services/nourish/insights";

/** Width-aware container: charts draw to whatever width layout gives. */
function useWidth() {
  const [width, setWidth] = useState(0);

  return {
    width,
    onLayout: (event: LayoutChangeEvent) =>
      setWidth(Math.floor(event.nativeEvent.layout.width)),
  };
}

export function BarChart({
  data,
  color,
  target,
  height = 130,
}: {
  data: readonly SeriesPoint[];
  color: string;
  /** Dashed reference line. */
  target?: number;
  height?: number;
}) {
  const { width, onLayout } = useWidth();
  const labelH = 18;
  const plotH = height - labelH;
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));
  const slot = data.length > 0 ? width / data.length : 0;
  const barW = Math.max(2, Math.min(22, slot * 0.62));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {target ? (
            <Line
              x1={0}
              x2={width}
              y1={plotH - (target / max) * plotH}
              y2={plotH - (target / max) * plotH}
              stroke={N.dim}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}
          {data.map((point, index) => {
            const h = (point.value / max) * plotH;
            const x = index * slot + (slot - barW) / 2;

            return (
              <Rect
                key={index}
                x={x}
                y={plotH - h}
                width={barW}
                height={Math.max(point.value > 0 ? 2 : 0, h)}
                rx={Math.min(4, barW / 2)}
                fill={color}
                opacity={point.value > 0 ? 1 : 0.25}
              />
            );
          })}
          {data.map((point, index) =>
            point.label ? (
              <SvgText
                key={`l${index}`}
                x={index * slot + slot / 2}
                y={height - 4}
                fontSize={10}
                fill={N.mute}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

export function LineChart({
  values,
  color = N.acc,
  height = 110,
}: {
  values: readonly number[];
  color?: string;
  height?: number;
}) {
  const { width, onLayout } = useWidth();
  const pad = 8;

  if (values.length < 2) return <View style={{ height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
          <Circle
            cx={x(values.length - 1)}
            cy={y(values[values.length - 1] ?? min)}
            r={4}
            fill={color}
          />
        </Svg>
      ) : null}
    </View>
  );
}
