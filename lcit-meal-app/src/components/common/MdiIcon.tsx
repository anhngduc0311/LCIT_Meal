
interface MdiIconProps {
  path: string;
  size?: number;
  className?: string;
}

const MdiIcon: React.FC<MdiIconProps> = ({
  path,
  size = 1,
  className = "",
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24 * size}
      height={24 * size}
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} />
    </svg>
  );
};

export default MdiIcon;