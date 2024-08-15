import React from "react";

interface PickupRequestsProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
}

const PickupRequests: React.FC<PickupRequestsProps> = ({
  size = "24",
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
        d="M12 2C8.69 2 6 4.69 6 8C6 9.09 6.24 10.16 6.68 11.13L3.23 14.58C2.44 15.37 2 16.48 2 17.69V20C2 20.55 2.45 21 3 21H21C21.55 21 22 20.55 22 20V17.69C22 16.48 21.56 15.37 20.77 14.58L17.32 11.13C17.76 10.16 18 9.09 18 8C18 4.69 15.31 2 12 2ZM12 4C14.21 4 16 5.79 16 8C16 9.01 15.74 10.01 15.31 10.91L15.68 11.28C16.46 12.06 17 13.04 17 14.13V16H7V14.13C7 13.04 7.54 12.06 8.32 11.28L8.69 10.91C8.26 10.01 8 9.01 8 8C8 5.79 9.79 4 12 4ZM14 16H10V18H14V16ZM12 14C11.45 14 11 13.55 11 13C11 12.45 11.45 12 12 12C12.55 12 13 12.45 13 13C13 13.55 12.55 14 12 14Z"
        fill={color}
      />
    </svg>
  );
};

export default PickupRequests;