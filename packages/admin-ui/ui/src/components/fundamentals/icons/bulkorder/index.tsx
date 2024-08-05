import React from "react";

interface BulkOrdersProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
}

const BulkOrder: React.FC<BulkOrdersProps> = ({
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
        d="M3 3H21C21.55 3 22 3.45 22 4V20C22 20.55 21.55 21 21 21H3C2.45 21 2 20.55 2 20V4C2 3.45 2.45 3 3 3ZM20 5H4V19H20V5ZM6 7H8V9H6V7ZM10 7H12V9H10V7ZM14 7H16V9H14V7ZM18 7H20V9H18V7ZM6 11H8V13H6V11ZM10 11H12V13H10V11ZM14 11H16V13H14V11ZM18 11H20V13H18V11ZM6 15H8V17H6V15ZM10 15H12V17H10V15ZM14 15H16V17H14V15ZM18 15H20V17H18V15Z"
        fill={color}
      />
    </svg>
  );
};

export default BulkOrder;