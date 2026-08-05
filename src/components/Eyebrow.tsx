export default function Eyebrow({
  children,
  className = "text-terracotta-600",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`font-accent text-label uppercase italic ${className}`}>
      {children}
    </p>
  );
}
