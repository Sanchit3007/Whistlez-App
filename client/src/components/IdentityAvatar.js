import { useState } from 'react';
import './IdentityAvatar.css';

const tones = ['rose', 'plum', 'indigo', 'blue', 'teal', 'green', 'amber', 'slate'];

const getTone = (key) => {
  let hash = 2166136261;
  for (const char of key) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  }
  return tones[(hash >>> 0) % tones.length];
};

const getInitials = (name) => {
  const words = name.normalize('NFC').match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) || [];
  if (words.length === 0) return '';
  const first = Array.from(words[0]);
  const initials = words.length > 1
    ? first[0] + Array.from(words[words.length - 1])[0]
    : first.slice(0, 2).join('');
  return Array.from(initials.toUpperCase()).slice(0, 2).join('');
};

const IdentityAvatar = ({ name = '', identity, image, business = false, size = 36, className = '', label }) => {
  const [failedImage, setFailedImage] = useState(null);
  const displayName = name || '';
  const initials = getInitials(displayName);
  const tone = getTone(String(identity || displayName.toLowerCase().trim()));

  return (
    <span
      className={`identity-avatar${business ? ' identity-avatar-business' : ''} ${className}`}
      data-tone={tone}
      style={{ '--identity-avatar-size': `${size}px` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {image && failedImage !== image ? (
        <img src={image} alt="" onError={() => setFailedImage(image)} />
      ) : initials || <i className={business ? 'bi bi-buildings' : 'bi bi-person-fill'} aria-hidden="true" />}
    </span>
  );
};

export default IdentityAvatar;
