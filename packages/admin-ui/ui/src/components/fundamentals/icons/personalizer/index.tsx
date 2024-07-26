import React from "react";

interface PersonalizerProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
}

const Personalizer: React.FC<PersonalizerProps> = ({
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
                d="M3.415 16.585C3.70519 16.8753 4.04973 17.1055 4.42892 17.2626C4.80812 17.4197 5.21455 17.5006 5.625 17.5006M3.415 16.585C4.00105 17.1711 4.7962 17.5006 5.625 17.5006M3.415 16.585C2.82895 15.9989 2.5 15.2038 2.5 14.375V3.4375C2.5 2.92 2.92 2.5 3.4375 2.5H7.8125C8.33 2.5 8.75 2.92 8.75 3.4375V6.83083M5.625 17.5006C6.03545 17.5006 6.44188 17.4197 6.82108 17.2626C7.20027 17.1055 7.54481 16.8753 7.835 16.585M5.625 17.5006C6.4538 17.5006 7.24895 17.1711 7.835 16.585M5.625 17.5006L16.5625 17.5C17.08 17.5 17.5 17.08 17.5 16.5625V12.1875C17.5 11.67 17.08 11.25 16.5625 11.25H13.1692M7.835 16.585L13.1692 11.25M7.835 16.585C8.42105 15.9989 8.75 15.2038 8.75 14.375V6.83083M13.1692 11.25L15.5683 8.85C15.935 8.485 15.935 7.89167 15.5683 7.525L12.475 4.43083C12.1083 4.065 11.515 4.065 11.15 4.43083L8.75 6.83083M5.625 14.375H5.63167V14.3817H5.625V14.375Z"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
};

export default Personalizer;