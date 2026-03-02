export interface DrawingTool {
  name: string;
  localeKey: string;
}

export interface DrawingToolCategory {
  key: string;
  tools: DrawingTool[];
}

export const DRAWING_CATEGORIES: DrawingToolCategory[] = [
  {
    key: "singleLine",
    tools: [
      { name: "horizontalStraightLine", localeKey: "horizontal_straight_line" },
      { name: "horizontalRayLine", localeKey: "horizontal_ray_line" },
      { name: "horizontalSegment", localeKey: "horizontal_segment" },
      { name: "verticalStraightLine", localeKey: "vertical_straight_line" },
      { name: "verticalRayLine", localeKey: "vertical_ray_line" },
      { name: "verticalSegment", localeKey: "vertical_segment" },
      { name: "straightLine", localeKey: "straight_line" },
      { name: "rayLine", localeKey: "ray_line" },
      { name: "segment", localeKey: "segment" },
      { name: "arrow", localeKey: "arrow" },
      { name: "priceLine", localeKey: "price_line" },
    ],
  },
  {
    key: "moreLine",
    tools: [
      { name: "priceChannelLine", localeKey: "price_channel_line" },
      { name: "parallelStraightLine", localeKey: "parallel_straight_line" },
    ],
  },
  {
    key: "polygon",
    tools: [
      { name: "circle", localeKey: "circle" },
      { name: "rect", localeKey: "rect" },
      { name: "parallelogram", localeKey: "parallelogram" },
      { name: "triangle", localeKey: "triangle" },
    ],
  },
  {
    key: "fibonacci",
    tools: [
      { name: "fibonacciLine", localeKey: "fibonacci_line" },
      { name: "fibonacciSegment", localeKey: "fibonacci_segment" },
      { name: "fibonacciCircle", localeKey: "fibonacci_circle" },
      { name: "fibonacciSpiral", localeKey: "fibonacci_spiral" },
      {
        name: "fibonacciSpeedResistanceFan",
        localeKey: "fibonacci_speed_resistance_fan",
      },
      { name: "fibonacciExtension", localeKey: "fibonacci_extension" },
      { name: "gannBox", localeKey: "gann_box" },
    ],
  },
  {
    key: "wave",
    tools: [
      { name: "xabcd", localeKey: "xabcd" },
      { name: "abcd", localeKey: "abcd" },
      { name: "threeWaves", localeKey: "three_waves" },
      { name: "fiveWaves", localeKey: "five_waves" },
      { name: "eightWaves", localeKey: "eight_waves" },
      { name: "anyWaves", localeKey: "any_waves" },
    ],
  },
];

export type MagnetMode = "normal" | "weak" | "strong";
