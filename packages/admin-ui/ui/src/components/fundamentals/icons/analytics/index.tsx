import React from "react";

interface AnalyticsProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
}

const Analytics: React.FC<AnalyticsProps> = ({
  size = "18",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <path
        d="M4 12V19C4 19.55 3.55 20 3 20C2.45 20 2 19.55 2 19V12C2 11.45 2.45 11 3 11C3.55 11 4 11.45 4 12ZM10 8V19C10 19.55 9.55 20 9 20C8.45 20 8 19.55 8 19V8C8 7.45 8.45 7 9 7C9.55 7 10 7.45 10 8ZM16 4V19C16 19.55 15.55 20 15 20C14.45 20 14 19.55 14 19V4C14 3.45 14.45 3 15 3C15.55 3 16 3.45 16 4ZM22 1V19C22 19.55 21.55 20 21 20C20.45 20 20 19.55 20 19V1C20 0.45 20.45 0 21 0C21.55 0 22 0.45 22 1Z"
        fill={color}
      />
    </svg>
  );
};

export default Analytics;