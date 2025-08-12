import Image from "next/image";

export default function SafeImg({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      width={400}
      height={300}
    />
  );
}
