'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ContactAvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

export function ContactAvatar({ name, src, size = 40, className = '' }: ContactAvatarProps) {
  const [failed, setFailed] = useState(false);
  const hasSrc = typeof src === 'string' && src.trim() !== '' && !failed;

  if (hasSrc) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(true)}
        className={`rounded-2xl object-cover border border-slate-200 shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials =
    name?.trim().split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '?';

  return (
    <div
      role="img"
      aria-label={name}
      className={`flex items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold border border-slate-200 shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}